# PR9 Per-Instance Leak Audit v2 — mixcr-amplicon-alignment

**Date:** 2026-05-21  
**Branch:** `MILAB-6069_v3-and-preview` at `c25e4c6`  
**Status:** BLOCKED — F1b is not block-side fixable without platform changes  
**Replaces:** `pr9-leak-audit-2026-05-21.md`

---

## 0. Retraction of v1 Claims (L5/L7)

The v1 audit (`pr9-leak-audit-2026-05-21.md`) identified L5 and L7 as the primary F1b root cause, claiming that `blockId` embedded in `axesByClonotypeKey[0].spec.domain["pl7.app/vdj/clonotypingRunId"]` flows into the inner pure-render CID through the `pframes.processColumn` → `Xsv` output path.

**This is wrong.** Source-verified evidence:

`SDK: workflow-tengo/src/pframes/util.lib.tengo:292–325` — `purifySpec` reduces every axis spec to `{ type: ax.spec.type }` before it reaches the pfconv binary or any pure template:

```tengo
purifySpec := func(spec) {
    newSpec := copy(spec)
    newAxes := []
    for ax in spec.axes {
        newAxes = append(newAxes, objects.deleteUndefined({
            column: ax.column,
            ...
            spec: { type: ax.spec.type }   // ← domain, name, annotations ALL stripped
        }))
    }
    ...
}
```

`SDK: workflow-tengo/src/pframes/index.lib.tengo:771–789` — for `Xsv` outputs, `decomposePfconvImportCfg` is called, returning `purifiedCfg: purifySpec(cfg)`. This purified config (without domain info) is what goes into `processedOutputs.settings`, which flows into `renderInputs.params` for the inner `render.createEphemeral(llProcessTpl, renderInputs)`.

Furthermore, `pframes.processColumn` itself calls `render.createEphemeral(llProcessTpl, renderInputs)` (index.lib.tengo:842) — the outer container is **ephemeral**, so no structural CID is computed at the processColumn boundary at all.

Conclusion: `blockId` in `axesByClonotypeKey` domain (L5, L7) **does not reach any pure template CID**. These are safe. Commit A from the v1 audit plan is unnecessary.

---

## 1. Fresh Error Traces (2026-05-21)

Run: `pnpm -C test test` on branch `c25e4c6`.

All failing tests show the same structural error path:

```
clonotypeTables
  → IGH.data
    → [sampleKey]   (e.g., ["JAHTGG2VZN4LW6FO5DWMXDJL"])
      → blob
        → resource
          → inputs
            → __value__
              → CIDConflict in "NG:0xXXXX/outputs/files" (RenderTemplate:1)
```

Observed conflicts (representative sample across one run):

| Test | Conflicting field type | Two CIDs |
|------|----------------------|----------|
| `simple project` (retry) | `RenderTemplate:1/outputs/files` | `C9BF2DEE…` vs `A64CBC1A…` |
| `simple project` (retry) | `RenderTemplate:1/outputs/files` | `5EF2EBD5…` vs `3B445B69…` |
| `FR2:FR4 with imputation` (retry) | `RenderTemplate:1/outputs/files` | `14283CA2…` vs `47CC383B…` |
| `CDR1:CDR3 without imputation` (retry) | `RenderTemplate:1/outputs/files` | `75F05171…` vs `9CCF3E70…` |

The path is **stable** across runs. The CID values vary because they encode which topological path tried to register first.

Also observed: a secondary conflict pattern in `simple project` at `json/getField:1/result`, which is downstream propagation of the same `outputs/files` conflict.

---

## 2. Trace: Error Path → Template → Leaking Input

### 2.1 Path Resolution

```
clonotypeTables                                    ← pFrameBuilder output, process.tpl.tengo
  IGH.data                                         ← per-chain partition
    [sampleKey]                                    ← per-sample key in clonotypeTable ResourceMap
      blob → resource → inputs → __value__         ← field chain inside the ResourceMap item
        outputs/files (RenderTemplate:1)           ← pure exec template inside mixcr-analyze.tpl.tengo
```

The `clonotypeTables` builder is fed by `exportResults.outputData("clonotypeTable")` at `process.tpl.tengo:~286`. `clonotypeTable` is the `Resource` output of `pframes.processColumn(mixcrResults.output("clns"), mixcrExportTpl, exportOutputs, ...)`. The `clonotypeTable` ResourceMap contains per-sample data produced by the `mixcr-export.tpl.tengo` body.

But the error propagates through the `clns` field, which means the conflict is actually in the **upstream `mixcr-analyze.tpl.tengo` body** — the clonotypeTable depends on `mixcrResults.outputData("clns")`, and the `clns` field carries the error up from the analyze step.

### 2.2 The Conflicting Pure Template

The conflict is in `outputs/files` of a `RenderTemplate:1` inside `mixcr-analyze.tpl.tengo`.

Execution chain:

1. `process.tpl.tengo` (ephemeral, `awaitState("InputsLocked")`) calls `pframes.processColumn(...)` with `mixcrAnalyzeTpl`.
2. SDK `index.lib.tengo` calls `render.createEphemeral(llProcessTpl, renderInputs)` — outer container is ephemeral (no CID).
3. Inside `process-pcolumn-data.tpl.tengo`, per-sample iteration calls:
   ```tengo
   renderResult := render.createUniversal(body, eph, renderInputs, { metaInputs: metaInputs })
   ```
   with `eph = undefined` (falsy, because `isEphemeral` is not set in the `processColumn` options). `render.createUniversal` with `eph=false` calls `render.create(mixcrAnalyzeTpl, renderInputs)` — **a pure template**.
4. Inside `mixcr-analyze.tpl.tengo`, `exec.builder()...run()` calls `render.create(exec.exec, pureExecInputs)` — another **pure template**. Its `outputs/files` field is the conflicting resource.

### 2.3 What Flows Into the Pure MiXCR Analyze CID

The `renderInputs` for step 3 above:
- `VALUE_FIELD_NAME` — the per-sample FASTQ data resource reference (CID of the FASTQ content)
- `params` — `smart.createJsonResource({fileExtension, referenceLibrary, assemblingFeature, imputeGermline, ...})` — a JSON resource whose CID encodes all of these values
- `__extra_params` — (extra map fields passed via `renderInputs["__extra_" + k] = v`)
- `__meta_*` — meta inputs (not in structural CID)

The structural CID of the pure `render.create(mixcrAnalyzeTpl, ...)` is:

```
hash(mixcrAnalyzeTpl_ref ‖ canonical({
    VALUE_FIELD_NAME: <fastq_data_CID>,
    params: <params_json_resource_CID>,
    ...
}))
```

When two test instances (different `blockId`, different projects) run `render.create(mixcrAnalyzeTpl, ...)` with **identical FASTQ data and identical preset parameters**, their structural CIDs are identical. The backend sees two topological paths attempting to own the same `outputs/files` field → `CIDConflictError`.

### 2.4 Why the Conflict Triggers on Retry

From `cid-investigation-2-2026-05-21.md` §2d:

`simple project` runs three presets sequentially (VDJRegion → FR2:FR4 → CDR1:CDR3) within one `blockTest`. When the block fails partway through (e.g., due to the now-reverted export-report conflict or any other error), vitest retries the whole `blockTest`. The retry creates a **new block instance** (new `blockId`, new topological root) but uses the **same backend session and same RocksDB glossary**. The same FASTQ data + same preset → same pure MiXCR analyze CID → same `outputs/files` slot → conflict with the previous attempt's registration.

Why VDJRegion doesn't fail: it runs first, completes and settles cleanly. Its CID slot is already claimed with the correct connection before any retry happens. CDR1:CDR3 and FR2:FR4 fail because they run after VDJRegion, and any initial failure triggers a retry that re-enters the same CID.

### 2.5 Why `aggregate-by-clonotype-key.tpl.tengo` Is Not the Conflict Site

`aggregate-by-clonotype-key.tpl.tengo` also uses `self.defineOutputs` (pure) and calls `pt.workflow().run()` → `render.create(workflowRunTpl, runInputs)`. However, `runInputs.inFiles` contains the per-sample clonotypeTable files — which are themselves outputs of the per-sample pure MiXCR analyze exec. The aggregation-level CID therefore cascades from the analyze-level conflict, not the other way around. The error propagates through `clns` (from the analyze step) before reaching the aggregation layer.

---

## 3. Revised Leak Inventory

### 3.1 L5/L7 — Retracted

`blockId` in `axesByClonotypeKey[0].spec.domain` at `calculate-export-specs.lib.tengo:1059` does NOT flow into any pure template CID. `purifySpec` strips all domain/annotation info to `{ type: ax.spec.type }` before the spec reaches `renderInputs.params`. **Safe. No fix needed.**

### 3.2 L8 — `sampleIdAxisSpec` in `render.create(exportReportTpl, ...)` — Still Valid

`process.tpl.tengo:357–370` passes `sampleIdAxisSpec: sampleIdAxisSpec` as a structural input to the pure `export-report.tpl.tengo`. Inside `export-report.tpl.tengo`, `sampleIdAxisSpec` flows into `reportColumnsSpec.axes[0].spec` (via `qcReportColumns`), then into `xsv.importFile(tsvFile, "tsv", reportColumnsSpec, ...)`. The Parquet path calls `xsvImportPt.importFileParquet(...)` → `pt.workflow().run()` → `render.create(workflowRunTpl, runInputs)` where `runInputs` encodes `saveParams.axes[0].spec` = the full `sampleIdAxisSpec` (with per-dataset domain).

**L8 is a real CID leak.** However, it is not the cause of the currently-observed F1b failures. The 10fe263 fix addressed L8 (export-report pure→ephemeral) but was reverted due to the `chainData.inputs()` regression (see §5). L8 remains unfixed.

### 3.3 L9 — `perProcessMemGB` in `render.create(exportReportTpl, ...)` — Still Valid

`process.tpl.tengo:366` passes `perProcessMemGB` as a structural input to the pure `export-report.tpl.tengo`. This per-instance tuning parameter varies between block configurations and flows into the pure template CID. **L9 is a real CID leak.** Not the F1b cause; unfixed.

### 3.4 L10 — `reportColumnsSpec` in `xsv.importFile` without `splitDataAndSpec: true` — Still Valid

`export-report.tpl.tengo:338–345` calls `xsv.importFile(tsvFile, "tsv", reportColumnsSpec, { cpu: 1, mem: "16GiB" })` without `splitDataAndSpec: true`. The full `reportColumnsSpec` (including `sampleIdAxisSpec.domain`) flows into `importFileParquet` → `pt.workflow-run` pure template. This is the same L8 path but at the inner importFile call site. **L10 is the same leak as L8, expressed at the xsv call.** Not the F1b cause; unfixed.

### 3.5 The Real F1b — Pure MiXCR Analyze Body (Not in v1 Audit)

**This leak was absent from the v1 audit.** It is a structural property of the block design:

`pframes.processColumn` with `mixcrAnalyzeTpl` and default `eph=undefined` renders each per-sample MiXCR analysis as a **pure** `RenderTemplate:1`. The structural CID of this render depends only on the FASTQ data content and the MiXCR preset parameters. There is **no per-instance identity** (no `blockId`, no per-project marker) in these structural inputs. When two test instances run the same FASTA with the same preset, the same pure render is attempted from two topological paths → `CIDConflictError` on `outputs/files`.

This is correct behavior for caching/deduplication when the same data is being processed — the system correctly shares the result. The conflict occurs only when the **topological paths diverge after the pure render settles**, which happens in the retry-within-session scenario.

| Leak | Location | State | Flows into CID? | F1b cause? | Status |
|------|----------|-------|-----------------|------------|--------|
| ~~L5~~ | `calculate-export-specs.lib.tengo:1059` | `blockId` in `axesByClonotypeKey` domain | **NO — purifySpec strips domain** | No | Retracted |
| ~~L7~~ | Same as L5 (aggregation path) | Same | **NO** | No | Retracted |
| L8 | `process.tpl.tengo:357–370` | `sampleIdAxisSpec` in `exportReportTpl` inputs | YES | No (secondary) | Unfixed (10fe263 reverted) |
| L9 | `process.tpl.tengo:366` | `perProcessMemGB` in `exportReportTpl` inputs | YES | No (secondary) | Unfixed |
| L10 | `export-report.tpl.tengo:341–345` | `reportColumnsSpec` (incl. `sampleIdAxisSpec.domain`) in `xsv.importFile` | YES | No (secondary) | Unfixed |
| **NEW** | `process-pcolumn-data.tpl.tengo:425` | `render.createUniversal(mixcrAnalyzeTpl, eph=false, ...)` per-sample body | YES — same FASTQ + preset → same CID | **YES — primary F1b** | Not block-side fixable |

---

## 4. Revised Fix Assessment

### 4.1 F1b — Not Block-Side Fixable (Without Platform Changes)

The F1b conflict is in the per-sample `render.create(mixcrAnalyzeTpl, ...)` call inside `process-pcolumn-data.tpl.tengo`. This is SDK machinery, not block code. The block cannot change whether `render.createUniversal` uses `eph=false` without opt-ing the entire `processColumn` call into ephemeral mode (`isEphemeral: true`), which would disable deduplication for all MiXCR analysis runs — a significant performance regression for production use.

Three possible remedies, none block-side:

1. **SDK fix (preferred):** Add retry-safe semantics to `render.createUniversal` when called in a retry context — either by passing a per-instance nonce via `metaInputs` that breaks the CID tie during retries, or by adding `hash_override` support to `processColumn` options (propagated from `block.id`).

2. **Test harness fix:** Restart the `pl` backend between vitest retries (or set `retry: 0` in `test/vitest.config.mts` as a short-term workaround — tests that fail on first attempt fail cleanly without triggering retry-collision).

3. **hash_override** at the `processColumn` call site: pass `hashOverride: blockId` to `pframes.processColumn` options so that the per-sample pure renders get a per-instance nonce. **This IS block-side** but requires the SDK to thread `hashOverride` through `process-pcolumn-data.tpl.tengo` → `render.createUniversal`. Not currently supported; requires SDK addition.

**Recommended for MILAB-6069:** Accept F1b as pre-existing (it predates the V3 migration), document it, and unblock the PR with the `retry: 0` workaround or by skipping the affected test variants. The test `041dad0` already added `skip` for the preview-mode test citing F1b — apply the same pattern to the conflicting blockTests if needed.

### 4.2 L8/L9/L10 — Valid but Not Blocking

These leaks cause the `export-report.tpl.tengo` pure template to collapse across test instances with the same `sampleIdAxisSpec`. The 10fe263 fix was correct but triggered `chainData.inputs()` regression (§5). These leaks are **not the primary F1b driver** — they cause a secondary conflict on the export-report outputs, not the analyze-step `outputs/files` conflict that is the primary F1b error.

If L8/L9/L10 need fixing, the recommended approach is:

**Commit B (L8/L9):** In `process.tpl.tengo`, move `sampleIdAxisSpec` and `perProcessMemGB` from the structural inputs map to `metaInputs` in the `render.create(exportReportTpl, ...)` call. Inside `export-report.tpl.tengo`, access them via `inputs.sampleIdAxisSpec` (they will be available as meta inputs in the body).

**Commit C (L10):** In `export-report.tpl.tengo`, add `splitDataAndSpec: true` to `xsv.importFile`, then post-stamp `sampleIdAxisSpec` onto the returned data specs.

**Constraint from §5:** The `clonotypeTablesData` input to `export-report.tpl.tengo` CANNOT be passed across a `render.create` → `render.createEphemeral` boundary without SDK support for Tengo map rehydration. This was the regression in 10fe263. Therefore, `export-report.tpl.tengo` MUST remain a pure template (using `self.defineOutputs`). The L8/L9 fix via `metaInputs` is the only viable path.

---

## 5. The `export-report.tpl.tengo` Pure Constraint

Commit `10fe263` changed `export-report.tpl.tengo` from `self.defineOutputs` (pure) to `self.awaitState("AllInputsSet")` (ephemeral) and changed `render.create(exportReportTpl, ...)` to `render.createEphemeral(exportReportTpl, ...)` in `process.tpl.tengo`. It was reverted in `286a21b` with the following reason (from commit `24c0ac1`):

> `clonotypeTablesData` (a Tengo map wrapping PColumnData) crosses the `render.createEphemeral` boundary as raw `strictMap` instead of rehydrated accessor, so `chainData.inputs()` at `export-report.tpl.tengo:180` fails.

`clonotypeTablesData` is defined in `process.tpl.tengo` as:
```tengo
clonotypeTablesData := {}
clonotypeTablesData[chains] = exportResults.outputData("clonotypeTable")
```

It is a Tengo map where values are resource references (outputs of `pframes.processColumn`). When passed across a `render.createEphemeral` boundary, resource references are serialized as raw field references. Inside the ephemeral body, `chainData.inputs()` on such a reference fails because the SDK's accessor methods are not available on a raw field ref.

**Constraint:** `export-report.tpl.tengo` must stay pure. The L8/L9 fix must use `metaInputs`, not an ephemeral conversion.

Validation path before implementing L8/L9 fix: verify that `sampleIdAxisSpec` and `perProcessMemGB` accessed via `inputs.sampleIdAxisSpec` (as meta inputs) inside the body of a `render.create(exportReportTpl, ...)` call behave identically to structural inputs at runtime. Meta inputs are accessible in the body function; this is supported per the SDK `render.lib.tengo` docs.

---

## 6. What We Don't Know Yet

1. **Whether the SDK will add `hash_override` support for `processColumn`** — without this, the only block-side F1b mitigation requires forking the processColumn path. Awaiting SDK team decision (separate ticket from §4.1).

2. **Whether the L8/L9 `metaInputs` approach is correct at the SDK level** — the behavior of meta inputs inside a pure template body needs verification. The v1 audit's Commit C had a note about this but it was not empirically tested before the audit was written.

3. **Whether disabling retries (`retry: 0`) is acceptable for CI** — this suppresses F1b symptom but means first-attempt failures are not retried. If CI is flaky for other reasons, this could increase false-positive failure rates.

4. **Exact scope of `chainData.inputs()` regression** — commit 10fe263 only confirmed the regression at line 180 of `export-report.tpl.tengo`. It is not clear whether ALL map-valued inputs crossing the boundary have the same problem, or only those where `.inputs()` is called.

---

## 7. Revised Commit Plan

### Only if L8/L9/L10 fix is in scope for this PR:

**Commit B — Move `sampleIdAxisSpec` and `perProcessMemGB` to metaInputs (L8, L9)**

Files: `workflow/src/process.tpl.tengo`

In `process.tpl.tengo` at the `render.create(exportReportTpl, {...})` call (lines 357–370), move:
- `sampleIdAxisSpec: sampleIdAxisSpec` → `metaInputs`
- `perProcessMemGB: perProcessMemGB` → `metaInputs` (already in `metaExecInputs` elsewhere; confirm the pattern works here)

Verify: `inputs.sampleIdAxisSpec` and `inputs.perProcessMemGB` are accessible in `export-report.tpl.tengo` body. No other change to `export-report.tpl.tengo`.

**Commit C — Add `splitDataAndSpec: true` to `xsv.importFile` in `export-report.tpl.tengo` (L10)**

Files: `workflow/src/export-report.tpl.tengo`

Modify the `xsv.importFile` call at lines 341–345:
- Add `splitDataAndSpec: true` to the ops map.
- Update the return to use `pFrameBuilder` with post-stamped specs.
- Stamp `sampleIdAxisSpec` (from `metaInputs` after Commit B) onto the returned axis spec.

**Note:** Do NOT implement Commit A from v1 audit. L5/L7 are safe.

### For F1b (the primary test failure):

Do not implement a block-side fix. File a separate ticket for the SDK `hash_override` / processColumn retry semantics (per `cid-investigation-2-2026-05-21.md` §4). Short-term: apply `retry: 0` in `test/vitest.config.mts` or add `.skip` to the failing blockTest variants.

---

## 8. References

- `pr9-leak-audit-2026-05-21.md` — v1 audit (retracted L5/L7 claims; L8/L9/L10 still correct)
- `cid-investigation-2026-05-21.md` — first investigation, identified export-report as conflict site
- `cid-investigation-2-2026-05-21.md` — second investigation, identified MiXCR analyze pure body as F1b source, explained retry mechanism
- SDK `purifySpec`: `core/platforma/sdk/workflow-tengo/src/pframes/util.lib.tengo:292–325`
- SDK `processedOutputs` Xsv path: `core/platforma/sdk/workflow-tengo/src/pframes/index.lib.tengo:771–789`
- SDK `processColumn` outer render: `core/platforma/sdk/workflow-tengo/src/pframes/index.lib.tengo:842`
- SDK `process-pcolumn-data.tpl.tengo:425` — `render.createUniversal(body, eph, renderInputs, ...)`
- SDK `pt.lib.tengo:908` — `render.create(workflowRunTpl, runInputs, ...)` in `pt.workflow().run()`
- Commit `10fe263` — export-report pure→ephemeral fix (reverted)
- Commit `286a21b` — revert of 10fe263
- Commit `24c0ac1` — explanation of regression (`chainData.inputs()`)
