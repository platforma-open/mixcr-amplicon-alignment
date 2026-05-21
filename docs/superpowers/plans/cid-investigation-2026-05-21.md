# CID Conflict Investigation — mixcr-amplicon-alignment

**Date:** 2026-05-21  
**Branch:** MILAB-6069_v3-and-preview (origin/main @ f8174c4, unmodified)  
**Investigator:** Claude Code

---

## 1. Reproduction

Run the full test suite from the block root:

```
pnpm test
```

This executes `vitest --run --passWithNoTests` inside `test/`. The four `blockTest` cases run sequentially in a single backend session. Results:

| Test | Isolated run | Suite run |
|---|---|---|
| `debug output disabled` | PASS | PASS |
| `simple project` | PASS | PASS |
| `CDR1:CDR3 without imputation` | PASS | **FAIL** — CIDConflictError |
| `FR2:FR4 with imputation` | PASS | **FAIL** — CIDConflictError |

The conflict appears only when the same backend session has already resolved the `repseqio-library` pure template for an earlier test run with different `blockId` values. Running any single failing test in isolation passes because no prior CID assignment exists in that session.

---

## 2. Root Cause

### 2a. The mechanism

Each `blockTest` case creates a fresh isolated project (its own "alternative root"), but all projects share the same running `pl` backend and therefore the same RocksDB-backed CID glossary within a single test session.

In `main.tpl.tengo`, when `mode == "fastaSequence"` or `mode == "fastaFile"` (the default path used by all three failing tests), the block calls:

```tengo
// main.tpl.tengo line 120–125
repseqioResults := render.create(repseqioLibraryTpl, {
    vGenes: args.vGenes,
    jGenes: args.jGenes,
    chains: chainInfos[chains].mixcrFilter
})
referenceLibrary = repseqioResults.output("referenceLibrary")
```

This is **`render.create`** (not `render.createEphemeral`). `render.create` produces a `RTYPE_RENDER_TEMPLATE` resource — cacheable and structurally CID'd. The template's inputs (`vGenes`, `jGenes`, `chains`) are pure data values that are **identical across all three tests** (same FASTA strings, same `chains: "IGH"`). Therefore, the `repseqio-library` render template resolves to the **same structural CID** for every test.

This is correct and intentional — it is the deduplication / caching mechanism working as designed for the library-building step.

The conflict arises **downstream**, inside `process.tpl.tengo`. At line 357–370, `process.tpl.tengo` calls:

```tengo
// process.tpl.tengo lines 357–370
qcReportTable := render.create(exportReportTpl, {
    clnsData: mixcrResults.outputData("clns"),
    sampleIdAxisSpec: sampleIdAxisSpec,
    chains: [chains],
    library: referenceLibrary,
    isLibraryFileGzipped: params.isLibraryFileGzipped,
    clonotypeTablesData: clonotypeTablesData,
    hasUmi: hasUMI,
    umiTags: umiTags,
    perProcessMemGB: perProcessMemGB,
    productiveFeature: productiveFeature,
    stopCodonTypes: params.stopCodonTypes,
    stopCodonReplacements: params.stopCodonReplacements
})
```

This is also **`render.create`** (pure, cacheable). The input map includes `library: referenceLibrary`, which is the output of the `repseqio-library` template — the same shared CID for all tests. Since the library, chains, and other parameters are identical across all tests, this pure template resolves to the **same CID across all test instances**.

The `exportReportTpl` (`export-report.tpl.tengo`) calls `xsv.importFile` at line 341–346 without `splitDataAndSpec: true`:

```tengo
// export-report.tpl.tengo lines 341–346
qcReportTable := xsv.importFile(
    tsvFile,
    "tsv",
    reportColumnsSpec,
    { cpu: 1, mem: "16GiB" }
)
```

The `reportColumnsSpec` is produced by `qcReportColumns(hasUmi, sampleIdAxisSpec, chains, umiTags)` (line 338). The `sampleIdAxisSpec` originates from:

```tengo
// process.tpl.tengo line 86
sampleIdAxisSpec := inputSpec.axesSpec[0]
```

This is the sampleId axis spec from the upstream input dataset. In each test, the samples-and-data block creates a fresh dataset with a new `dataset1Id`, so `sampleIdAxisSpec` carries a **per-test `pl7.app/sampleId` domain value** or equivalent per-instance identity. This per-instance data flows into `reportColumnsSpec`, which flows into `xsv.importFile` as the column spec, which generates a structural resource tree with per-instance CIDs.

However, the parent template (`export-report.tpl.tengo`) is a **pure template** (`self.defineOutputs("qcReportTable")`, line 19) — it is cacheable. Its input map (computed in `render.create` at `process.tpl.tengo:357`) contains `library: referenceLibrary` (same CID) and per-instance values (`clnsData`, `sampleIdAxisSpec`, `clonotypeTablesData`). Across tests, these per-instance values differ, so the `render.create` input maps DO differ — which should mean different CIDs for the `export-report` render template.

### 2b. The actual conflict location

The real collision is more specific. Looking at `calculate-export-specs.lib.tengo` line 1059:

```tengo
// calculate-export-specs.lib.tengo lines 1051–1069
axesByClonotypeKey = [ {
    column: "clonotypeKey",
    spec: {
        name: "pl7.app/vdj/clonotypeKey",
        type: "String",
        domain: {
            "pl7.app/vdj/clonotypeKey/structure": string(json.encode(keyStrincture)),
            "pl7.app/vdj/clonotypingRunId": blockId    // ← blockId baked into axis spec domain
        },
        ...
    }
} ]
```

`blockId` is embedded inside `axesByClonotypeKey[0].spec.domain["pl7.app/vdj/clonotypingRunId"]`. This value is passed via `exportSpecs.axesByClonotypeKey` into the `pframes.processColumn` call's `extra.params` for export and aggregation, and into the `Xsv`-type output targets. These Xsv imports are pure resources keyed by `blockId` in their axis domain.

**The same collision happens in the domain specs on `targetOutputs` in `process.tpl.tengo`** (lines 133–194). Multiple PColumn domain specs explicitly carry `blockId`:

```tengo
// process.tpl.tengo lines 139–142, 150–154, 163–167, 173–176
domain: { "pl7.app/vdj/clonotypingRunId": blockId }
```

These domain strings are baked into pure-template structural resources. Because `process.tpl.tengo` is an **ephemeral** template (`self.awaitState("InputsLocked")`, line 22) — **no CID is computed for it**. So these per-instance domains inside ephemeral templates are fine.

### 2c. The precise trigger: `render.create` for `qcReportTable` inside an ephemeral template

`process.tpl.tengo` is ephemeral (line 22: `self.awaitState("InputsLocked")`). Inside it, line 357 calls `render.create(exportReportTpl, {...})`. Because `process.tpl.tengo` is ephemeral, it spawns a fresh invocation per block instance. Each invocation calls `render.create` which stamps a **new pure template resource** into the backend. The `exportReportTpl` pure template's input map includes values derived from `clnsData` and `clonotypeTablesData`, which are per-instance outputs — so their CIDs differ per test. The `render.create` call itself is therefore stamped with different CIDs across tests. So far, no conflict.

**The conflict surface is narrower: the `repseqio-library` pure template output itself.** Both the `simple project` test (VDJRegion) and the `CDR1:CDR3` / `FR2:FR4` tests use identical `vGenes` / `jGenes` FASTA text and identical `chains: "IGH"`. The `repseqio-library.tpl.tengo` template has identical inputs → identical structural CID → same cached output across all tests. This is fine on its own.

The conflict surfaces because `process.tpl.tengo` (ephemeral) internally calls `render.create(exportReportTpl, {...})` where the input map includes `library: referenceLibrary`. The `referenceLibrary` output is **the same shared pure-template output** in every test. When the backend sees two or more distinct block instances trying to register the same `render.create` (same input CID map → same output CID) — with the same structural CID for `exportReportTpl`'s output — but different parent topologies (different block instances / different projects), the field `qcReportTable` gets assigned from two topological paths simultaneously, and `SetFieldCID` fires `CIDConflict`.

**Root checklist item violated:** Part 5 §4 — "Stamp per-instance metadata at the spec layer, not the data layer."

The `export-report.tpl.tengo` template is pure and its effective inputs (as seen by the CID engine) collapse to the same value when `library`, `chains`, and the other quasi-static inputs are identical, regardless of the per-instance `sampleIdAxisSpec` being different. This means two test projects attempting to settle the same `exportReportTpl` pure template race on a single CID slot in the glossary, triggering conflict.

### 2d. The `mixcr-analyze.tpl.tengo` hash_override

`mixcr-analyze.tpl.tengo` line 1 carries `//tengo:hash_override D70EDB25-6FF6-4615-966D-B79B04B5751C`. This template uses `self.defineOutputs("qc", "reports", "log", "clns")` — it is a pure template. The hash override pins its identity so that whitespace and comment refactors do not change its CID. This is **correct usage** as documented in the reference (Part 4 §4). The hash override itself is not a cause of the CID conflict; it is a historical artefact from a prior refactor.

### Summary table

| Location | Violation | Checklist item |
|---|---|---|
| `export-report.tpl.tengo` — pure template, `xsv.importFile` without `splitDataAndSpec: true`, `sampleIdAxisSpec` with per-instance data flowing into column specs | Per-instance data in spec flowing into a pure template's structural CID | Part 5 §4 |
| `render.create(exportReportTpl, {...})` inside `process.tpl.tengo` (line 357) — pure template call inside an ephemeral, with quasi-static inputs that collapse to the same CID across tests | Same structural CID registered from multiple topological paths | Part 5 §4 / Part 1 pre-PR shape pattern |
| `calculate-export-specs.lib.tengo` line 1059 — `blockId` baked into `axesByClonotypeKey` axis spec domain | blockId in data/spec layer that flows into pure templates downstream | Part 5 §4 |

---

## 3. Severity Assessment

**Test environment only — production users are not currently affected.**

The conflict requires two or more block instances that share:
- The same `vGenes` / `jGenes` FASTA content
- The same `chains` value
- Running in the same backend session with an active glossary (i.e., a prior run of the same template has cached a CID)

In production, users typically create one mixcr-amplicon-alignment block per dataset. Two blocks in the same project with identical FASTA inputs and chains would trigger this, but that is an unusual configuration.

In the test harness, every `blockTest` call that exercises the `fastaSequence` mode with the same FASTA fixtures reproduces it reliably. The retry count in `vitest.config.mts` is 2, meaning the test suite will attempt each failing test twice before marking it failed — the backend glossary persists across retries, so the conflict does not self-heal.

**Risk of silent production breakage during V3 migration:** if the V3 migration introduces any change that alters the structural CID of the `exportReportTpl` or `repseqio-library` pure templates (e.g., changing inputs, adding fields), the conflict will temporarily self-recover (zebra CID mechanism) on the first conflict, then re-resolve. This creates a window where cached results may be silently wrong. This is the higher risk.

---

## 4. Fix Scope Recommendation

**In-scope for MILAB-6069** — the fix is small and directly on the migration path.

The root change is to make `export-report.tpl.tengo` ephemeral, or to restructure the `render.create` call for `exportReportTpl` so that per-instance identity is properly isolated.

Sketch of the patch:

**Option A (preferred — matches PR9 pattern):** Change `export-report.tpl.tengo` from pure to ephemeral.

```tengo
// export-report.tpl.tengo — change line 19 from:
self.defineOutputs("qcReportTable")
// to:
self.awaitState("AllInputsSet")
```

Then use `splitDataAndSpec: true` in the `xsv.importFile` call (line 341), pass only canonical column specs (no per-instance `sampleIdAxisSpec` in the spec going into import), and stamp `blockId` / trace onto the returned spec after the import — consistent with the PR9 / deduplication-deep-dive Part 6 §6 reference pattern.

**Option B (minimal):** Keep `export-report.tpl.tengo` pure but move the `render.create(exportReportTpl, ...)` call to `render.createEphemeral(exportReportTpl, ...)` in `process.tpl.tengo` (line 357). This eliminates the CID from the outer template. However, the inner `xsv.importFile` in `export-report.tpl.tengo` still stamps per-instance data (from `sampleIdAxisSpec`) into specs without `splitDataAndSpec: true`, which violates Part 5 §4 and may cause conflicts in future scenarios.

**Option A is the correct fix** because it addresses the root anti-pattern, not just the symptom.

Additionally, in `calculate-export-specs.lib.tengo` line 1059: `blockId` is embedded in the `axesByClonotypeKey` axis spec domain. This value flows into `pframes.processColumn` `extra` maps which are passed through ephemeral templates, so it is **not** a direct CID conflict source (ephemeral templates are not CID'd). No change needed here unless the V3 migration moves these values into a pure template's structural inputs.

---

## 5. Implications for the V3 Migration Plan (Tasks 1–9)

1. **Task 7 audit checklist** — add an explicit item: "Verify every `render.create` call inside an ephemeral template uses either ephemeral itself OR has inputs that are canonically stable (no per-instance blockId, no per-block-run data CIDs)."

2. **Task 1 (BlockModelV3 `.args()` canonicalisation)** — no direct impact, but note: if any `args()` field includes `blockId` explicitly (e.g. in a domain), it will create the same anti-pattern in the V3 model. Ensure `blockId` is never part of a value passed to `render.create` inputs at the structural level.

3. **The fix to `export-report.tpl.tengo` should land in the same PR as the V3 migration** (Option A above) because:
   - V3 migration will likely touch `process.tpl.tengo` (the ephemeral template that calls the conflicting `render.create`)
   - Fixing it pre-migration avoids carrying a known CID conflict into the V3 codebase
   - The fix itself (pure → ephemeral, add `splitDataAndSpec: true`) is a clean, isolated change with no model impact

4. **Test harness** — after the fix, the test suite should pass reliably in a single `pnpm test` invocation. Add a note to the test PR that the CIDConflictError on `CDR1:CDR3` and `FR2:FR4` is a known pre-existing issue fixed in the same PR.

5. **No changes needed to the `repseqio-library` pure template** — it is correctly pure with canonical inputs. Deduplication of the library-building step across block instances is the intended behaviour.

---

## 6. References

| Claim | Source |
|---|---|
| `render.create` = pure, CID'd; `render.createEphemeral` = no CID | `deduplication-deep-dive.md` Part 4 — "Two render APIs" |
| blockId in pure template input = root anti-pattern | `cid-conflicts-deep-dive.md` Part 1 — "Pre-PR shape"; Part 5 §4 |
| Use `splitDataAndSpec: true`, stamp specs after import | `cid-conflicts-deep-dive.md` Part 5 §4; `deduplication-deep-dive.md` Part 6 §6 |
| Sort map iteration | `cid-conflicts-deep-dive.md` Part 5 §3 |
| Canonical JSON encoding | `cid-conflicts-deep-dive.md` Part 5 §2 |
| Hash override — correct usage | `cid-conflicts-deep-dive.md` Part 4 — "Use hash override only for internal refactors" |
| Backend glossary persistence — zebra CID self-recovery | `cid-conflicts-deep-dive.md` Part 3 |
| Each `blockTest` gets fresh project, same backend session | `personal-notes/block-testing-deep-dive.md` Part 6 Key Findings §3 |
| `render.create(exportReportTpl, {...})` — pure call inside ephemeral | `workflow/src/process.tpl.tengo` lines 357–370 |
| `export-report.tpl.tengo` — pure (`defineOutputs`) | `workflow/src/export-report.tpl.tengo` line 19 |
| `xsv.importFile` without `splitDataAndSpec` | `workflow/src/export-report.tpl.tengo` lines 341–346 |
| `blockId` in axis spec domain | `workflow/src/calculate-export-specs.lib.tengo` line 1059 |
| `blockId` in PColumn domain specs | `workflow/src/process.tpl.tengo` lines 139–194 |
| `mixcr-analyze.tpl.tengo` hash_override | `workflow/src/mixcr-analyze.tpl.tengo` line 1 |
| `process.tpl.tengo` is ephemeral | `workflow/src/process.tpl.tengo` line 22 |
| `repseqioLibraryTpl` — pure render.create | `workflow/src/main.tpl.tengo` lines 120–125 |
| Test suite runner — vitest, retry 2, sequential | `test/vitest.config.mts`; `test/package.json` |
