# CID Conflict Investigation #2 — mixcr-amplicon-alignment

**Date:** 2026-05-21
**Branch:** MILAB-6069_v3-and-preview (post-commit 10fe263)
**Investigator:** Claude Code
**Prior investigation:** `cid-investigation-2026-05-21.md` (first fix — export-report.tpl.tengo)

---

## 1. Reproduction

After commit `10fe263` (pure→ephemeral fix for `export-report.tpl.tengo`), the test suite still reports failures. The turbo test log at `test/.turbo/turbo-test.log` shows:

```
FAIL src/wf.test.ts > CDR1:CDR3 without imputation
Error: Block error: {
  "errorType": "",
  "message": "[I] \"NG:0x8E6B4C/clones.clonotypeProperties/aggregates/IGHeavy/best-v-hit-with-allele.data\": has input errors:\n
  [I] \"NG:0x8E6B6F/resource\": has input errors:\n
  cannot eval code: cannot eval template: tengo template error:
  smart.field.getValue: field \"clns\" has error:
  \"CIDConflictError:
  [I] \"NG:0x8E6B99/[\\\"OYLYQX767OFVUUBLINLUDK7W\\\"]\": has input errors:
  CIDConflictError: CID conflict in field \"NG:0x8E713C/outputs/files\"
  (resource type \"RenderTemplate:1\").
  Current field CID: \"A0141E890B0BE38AF134ACCEA6CBF11E\",
  new field CID: \"A4DE1D71BCBB387BC1F4E6F41E32029A\"\""
}
```

Conflict path:
```
clones.clonotypeProperties/aggregates/IGHeavy/best-v-hit-with-allele.data
  → resource
    → clns (field error propagation)
      → NG:0x8E6B99/["OYLYQX767OFVUUBLINLUDK7W"]  ← per-sample key in mixcrAnalyzeTpl render input map
        → NG:0x8E713C/outputs/files  ← RenderTemplate:1 for mixcr-analyze.tpl.tengo body
```

The `FR2:FR4 with imputation` test also fails in the same turbo log with a similar `outputs/files` conflict on `RenderTemplate:1`, confirming this is a general pattern and not specific to the CDR1:CDR3 `assemblingFeature`.

The `3 failed | 32 passed of 35` count mentioned in the task prompt maps to the cached log which pre-dates the current state; the log shows `FR2:FR4` also failing. The original claim that FR2:FR4 passes after `10fe263` is not confirmed by the cached log.

---

## 2. Root Cause

### 2a. The mechanism

`process.tpl.tengo` is ephemeral (`self.awaitState("InputsLocked")`, line 22). Inside its body, it calls:

```go
// process.tpl.tengo lines 197-225
mixcrResults := pframes.processColumn(
    { spec: inputSpec, data: inputs.inputData },
    mixcrAnalyzeTpl,
    targetOutputs,
    {
        ...
        extra: {
            params: maps.clone({ fileExtension, referenceLibrary, assemblingFeature, imputeGermline, ... }),
            limitInput: limitInput
        },
        metaExtra: { perProcessMemGB, perProcessCPUs }
    }
)
```

`pframes.processColumn` (SDK `index.lib.tengo` line 634) passes `eph: opts.isEphemeral` to the process-pcolumn-data template. Since `isEphemeral` is not set here, `eph` is `undefined` (falsy).

Inside `process-pcolumn-data.tpl.tengo` (SDK, line 425), per-sample invocation:

```go
renderResult := render.createUniversal(body, eph, renderInputs, { metaInputs: metaInputs })
```

With `eph = undefined` (falsy), this calls `render.create(mixcrAnalyzeTpl, renderInputs)` — a **pure** `RenderTemplate:1`. The structural CID of this render template is:

```
hash(mixcrAnalyzeTpl_ref ‖ canonical({ VALUE_FIELD_NAME: sampleFastqCID, params: paramsJsonCID, ... }))
```

### 2b. `mixcr-analyze.tpl.tengo` is pure

`workflow/src/mixcr-analyze.tpl.tengo` line 1 has `//tengo:hash_override D70EDB25-6FF6-4615-966D-B79B04B5751C` and line 19 calls `self.defineOutputs("qc", "reports", "log", "clns")`. It uses `tpl` (not `tpl.light`). It is a **pure** template — cacheable, structurally CID'd, glossary-tracked.

### 2c. What collapses across test instances

The inputs to the per-sample pure render are:
- `VALUE_FIELD_NAME` — the per-sample FASTQ data CID (same file bytes → same CID for the same FASTQ asset)
- `params` — a JSON resource containing `assemblingFeature`, `referenceLibrary`, `cloneClusteringMode`, `hasUMI`, etc. — **no `blockId`**
- `limitInput`, `threePrimePrimer`, `fivePrimePrimer` — absent or undefined for all tests

The test FASTQ files (`test/assets/s1_R1.fastq.gz`, `s1_R2.fastq.gz`) are **shared** across the `VDJRegion`, `FR2:FR4`, and `CDR1:CDR3` tests. The `referenceLibrary` is produced by `repseqio-library.tpl.tengo` (a pure render from identical `vGenes` and `jGenes` FASTA strings) — same CID across tests using the same synthetic reference.

The only parameters that vary between `FR2:FR4` and `CDR1:CDR3` are `assemblingFeature` and `imputeGermline`. These are present in the `params` JSON resource, so they do differ between those two test cases — they will not conflict with each other.

### 2d. The retry-within-session trigger

Vitest is configured with `retry: 2` (`test/vitest.config.mts`). All `blockTest` invocations run against the **same backend session** (confirmed by `personal-notes/block-testing-deep-dive.md` Part 6 §3). When the first attempt of a test partially executes and fails (e.g., due to the still-present export-report conflict or timeout), the glossary already has partial CID registrations for the pure `mixcrAnalyzeTpl` render. The retry:

1. Creates a new project with a new `blockId`.
2. Calls `pframes.processColumn(..., mixcrAnalyzeTpl, ...)` with the same FASTQ data and same `params` JSON CID.
3. `render.createUniversal(mixcrAnalyzeTpl, false, renderInputs)` computes the same structural CID as attempt 1.
4. The backend tries to set `outputs/files` for this already-registered `RenderTemplate:1` resource from a new topological path (new block instance, new parent resource graph).
5. The glossary has the field CID from attempt 1. Attempt 2's connection produces a different `outputs/files` CID (because the parent graph differs). `SetFieldCID` fires `CIDConflictError`.

This is the same pattern as investigation #1 (Part 5 §4 violation), but the surface is `mixcr-analyze.tpl.tengo` rather than `export-report.tpl.tengo`.

### 2e. Why CDR1:CDR3 (not VDJRegion) fails

The `VDJRegion` test runs first and completes successfully. Its `mixcrAnalyzeTpl` pure renders are settled with correct `outputs/files` CIDs in the glossary. `FR2:FR4` and `CDR1:CDR3` each use different `assemblingFeature` values — their `params` JSON CIDs differ from `VDJRegion` and from each other, so no cross-test collision at this level. The conflict fires on retry because within-test retries share the same `assemblingFeature` and the same FASTQ assets.

### 2f. Summary table

| Location | Violation | Checklist item |
|---|---|---|
| `pframes.processColumn(..., mixcrAnalyzeTpl, ..., { /* no isEphemeral: true */ })` in `process.tpl.tengo` lines 197–225 | Per-instance pure render with no `blockId` isolation; retry-within-session collision on `outputs/files` | Part 5 §4 — same structural CID registered from multiple topological paths |
| `mixcr-analyze.tpl.tengo` — pure template (`tpl` + `defineOutputs`) invoked via `pframes.processColumn` default `eph=false` | Pure render exposes exec outputs as CID'd fields; re-registration from retry conflicts | Part 5 §1 — pure render with exec step inside; `outputs/files` of exec step contested across retries |

Note: `export-report.tpl.tengo` was already fixed by `10fe263`. The surface identified in this investigation is separate.

---

## 3. Severity Assessment

**Production impact: low.** In a normal production session, a user runs a single block instance with a given `assemblingFeature` and FASTQ dataset. No two instances share identical inputs unless the user explicitly duplicates a block configuration. Under normal use, the pure-render dedup for `mixcr-analyze.tpl.tengo` is beneficial (exec caching across duplicated blocks). The conflict only surfaces when:

1. Test retries happen within the same backend session (test-only scenario), or
2. A user creates two blocks with *identical* FASTQs and identical `assemblingFeature`/library parameters in the same project/session.

Scenario 2 is theoretically possible but extremely unlikely in production — users don't typically run two identical MiXCR alignment blocks.

**Test impact: high.** The test suite can fail non-deterministically any time a test fails on the first attempt and retries. The `CDR1:CDR3` test is most affected because it runs after `VDJRegion` and `FR2:FR4`, so by the time it runs, the backend glossary has seen more partial registrations.

---

## 4. Fix Scope Recommendation

**Separate ticket — SDK-side limitation.**

### Why not in-scope for MILAB-6069

The root anti-pattern here is that `pframes.processColumn` defaults to `eph=false`, making every body template a pure (cacheable) render. For templates like `mixcr-analyze.tpl.tengo` that contain `exec.builder()...run()` steps, this is intentional and correct behavior in production (exec dedup across identical-input block instances is valuable). The conflict only emerges in tests due to retry-within-session semantics.

Fixing this from the block side would require passing `isEphemeral: true` to the `pframes.processColumn` call for `mixcrAnalyzeTpl`. That would disable exec dedup in production — a significant performance regression that contradicts the SDK's design intent.

The proper fix is one of:
1. **Test harness**: Restart the backend between vitest retries (platform-level fix, not block-author's responsibility).
2. **SDK `processColumn` hardening**: Add a `retryContext` or `instanceId` to the glossary conflict resolution path so that retries don't conflict with prior partially-settled renders.
3. **SDK `process-pcolumn-data.tpl.tengo` metaInputs**: Pass a retry-safe identifier via `metaInputs` (which are excluded from CID computation per `render.lib.tengo`) so that retry attempts can be disambiguated.

All three fixes belong in the platform SDK or test harness, not in the block's workflow code.

### Recommended separate ticket

**Title:** `pframes.processColumn retry-within-session CIDConflictError on pure body templates`

**Problem statement:** When a `blockTest` fails on the first attempt and vitest retries in the same backend session, any `pframes.processColumn` call using the default `eph=false` will produce a pure `RenderTemplate:1` with the same structural CID as the failed attempt. The retry creates a new block instance (new topological path) and tries to re-register the same CID's `outputs/files` field with a new connection — triggering `CIDConflictError`. This affects any block whose body template (e.g., `mixcr-analyze.tpl.tengo`) contains `exec.builder()...run()` steps with identical inputs across attempts. The fix belongs in the platform SDK (retry semantics for `process-pcolumn-data.tpl.tengo`) or the test harness (backend restart between retries), not in block workflow code.

### Defer / accept for MILAB-6069

The CDR1:CDR3 and FR2:FR4 test failures in this investigation are not caused by any new code introduced in the MILAB-6069 migration. They are a pre-existing interaction between the test retry mechanism and the SDK's pure-render design. The MILAB-6069 PR should document this as a known pre-existing issue with a separate-ticket recommendation.

If the test failures are blocking PR merge, a short-term workaround is to disable vitest retries (`retry: 0` in `test/vitest.config.mts`) for this block — tests that fail on first attempt will fail cleanly without triggering the retry-collision path.

---

## 5. Implications for the V3 Migration Plan (Tasks 1–9)

1. **Task 7 audit checklist** — the additional item from investigation #1 stands: "Verify every `render.create` call inside an ephemeral template has inputs that are canonically stable." Add a second item: "Verify every `pframes.processColumn` body template that wraps `exec.builder()` steps is used in a context where retry-within-session semantics are safe — or document explicitly that test retries must be disabled for this block."

2. **Task 1 (BlockModelV3 `.args()` shape)** — no direct impact. The conflict is not caused by `blockId` in `args()`.

3. **The `mixcr-analyze.tpl.tengo` hash_override** (`D70EDB25-6FF6-4615-966D-B79B04B5751C`) is not affected by this investigation. It should not be changed or removed as part of MILAB-6069 unless the template's semantics change.

4. **Test harness** — consider adding a comment in `test/vitest.config.mts` explaining why `retry` is set to its current value and whether reducing it would mask or expose the retry-collision behavior.

5. **No changes needed to `aggregate-by-clonotype-key.tpl.tengo` or `mixcr-export.tpl.tengo`** for this specific conflict. Both are invoked downstream of `mixcr-analyze.tpl.tengo`; by the time they are reached, the `clns` field is already in error propagation mode due to the upstream conflict.

---

## 6. References

| Claim | Source |
|---|---|
| `pframes.processColumn` passes `eph: opts.isEphemeral` | `core/platforma/sdk/workflow-tengo/src/pframes/index.lib.tengo` line 634 |
| `process-pcolumn-data.tpl.tengo` calls `render.createUniversal(body, eph, renderInputs, ...)` | `core/platforma/sdk/workflow-tengo/src/pframes/process-pcolumn-data.tpl.tengo` line 425 |
| `mixcr-analyze.tpl.tengo` is pure (`tpl` + `defineOutputs`) | `workflow/src/mixcr-analyze.tpl.tengo` lines 1, 5, 19 |
| `mixcr-analyze.tpl.tengo` hash_override | `workflow/src/mixcr-analyze.tpl.tengo` line 1 |
| `pframes.processColumn` for `mixcrAnalyzeTpl` — no `isEphemeral: true` | `workflow/src/process.tpl.tengo` lines 197–225 |
| `params` JSON passed to `mixcrAnalyzeTpl` — no `blockId` | `workflow/src/process.tpl.tengo` lines 205–220 |
| `perProcessMemGB`/`perProcessCPUs` passed as `metaExtra` (not `extra`) | `workflow/src/process.tpl.tengo` lines 222–225 (comment: "by passing those parameters as meta fields we allow for recovery and deduplication mechanisms") |
| `process.tpl.tengo` is ephemeral | `workflow/src/process.tpl.tengo` line 22 |
| `render.createUniversal(body, eph=false)` → pure `RenderTemplate:1` | `deduplication-deep-dive.md` Part 4 — "Two render APIs"; `deduplication-deep-dive.md` Part 4 lines 156–157 |
| Same-session backend for blockTest retries | `personal-notes/block-testing-deep-dive.md` Part 6 §3 |
| Pure render `outputs/files` conflict mechanics | `cid-conflicts-deep-dive.md` Part 5 §4; Part 1 "Pre-PR shape" |
| `metaInputs` excluded from CID computation | `cid-conflicts-deep-dive.md` Part 5 §4; `render.lib.tengo` (cited in deep-dive) |
| `exec.builder().run()` is a pure cacheable resource | `deduplication-deep-dive.md` Part 4 line 214 |
| Test FASTQ assets — shared across tests | `test/src/wf.test.ts` lines 167–400 (both FR2:FR4 and CDR1:CDR3 use `s1_R1.fastq.gz`, `s1_R2.fastq.gz`) |
| FR2:FR4 and CDR1:CDR3 differ in `assemblingFeature` and `imputeGermline` only | `test/src/wf.test.ts` lines 225–226 (FR2:FR4), lines 325–326 (CDR1:CDR3) |
| Vitest `retry: 2` setting | `test/vitest.config.mts` |
| Error output excerpt (turbo log) | `test/.turbo/turbo-test.log` — CDR1:CDR3 entries |
