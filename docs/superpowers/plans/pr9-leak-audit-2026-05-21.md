# PR9 Per-Instance Leak Audit — mixcr-amplicon-alignment

**Date:** 2026-05-21  
**Branch:** `MILAB-6069_v3-and-preview` at `24c0ac1`  
**Scope:** Find every per-instance state leak flowing into a CID-affecting path (pure template inputs, `xsv.importFile` specs, `pframes.processColumn` `traceSteps`/`extra`). Feeds the PR9 fix that replaces reverted commit `10fe263`.

---

## 1. Per-Instance State Inventory

### 1.1 `blockId`

**Source:** `main.tpl.tengo:25` — `blockId := wf.blockId().getDataAsJson()`

**Propagation path:**

| Step | File:Line | How used |
|------|-----------|----------|
| Read | `main.tpl.tengo:25` | `blockId := wf.blockId().getDataAsJson()` |
| Baked into params JSON | `main.tpl.tengo:137` | `blockId: blockId` — included in `smart.createJsonResource(...)` passed as `params` input to `processTpl` |
| Read back inside ephemeral | `process.tpl.tengo:30` | `blockId := params.blockId` |
| Passed to spec builder | `process.tpl.tengo:97` | `exportSpecs := calculateExportSpecs(presetSpecForBack, blockId)` |
| Axis domain (clonotypeKey) | `calculate-export-specs.lib.tengo:1059` | `"pl7.app/vdj/clonotypingRunId": blockId` in `axesByClonotypeKey[0].spec.domain` |
| Target output spec domain (qc) | `process.tpl.tengo:140` | `"pl7.app/vdj/clonotypingRunId": blockId` |
| Target output spec domain (log) | `process.tpl.tengo:150` | `"pl7.app/vdj/clonotypingRunId": blockId` |
| Target output spec domain (clns) | `process.tpl.tengo:161` | `"pl7.app/vdj/clonotypingRunId": blockId` |
| Target output spec domain (reports) | `process.tpl.tengo:174` | `"pl7.app/vdj/clonotypingRunId": blockId` |
| Export output spec domain (clonotypeTable) | `process.tpl.tengo:251` | `"pl7.app/vdj/clonotypingRunId": blockId` |
| Aggregation output spec domain (clonotypeProperties) | `process.tpl.tengo:309` | `"pl7.app/vdj/clonotypingRunId": blockId` |
| traceSteps — MiXCR analyze | `process.tpl.tengo:212` | `id: blockId` in `traceSteps[0]` of first `pframes.processColumn` call |
| traceSteps — aggregate | `process.tpl.tengo:335` | `id: blockId + "." + chains` in `traceSteps[0]` of second `pframes.processColumn` call |
| Library export spec domain | `main.tpl.tengo:177` | `"pl7.app/vdj/libraryId": blockId` in `exports.library.spec.domain` (mode=`libraryFile` only) |

### 1.2 Per-Instance Domain Stamps: `pl7.app/vdj/clonotypingRunId`

All uses of this key carry `blockId` as value. Summary of every location:

- `process.tpl.tengo:140` — `targetOutputs[0]` (qc)
- `process.tpl.tengo:150` — `targetOutputs[1]` (log)
- `process.tpl.tengo:161` — `targetOutputs[2]` (clns)
- `process.tpl.tengo:174` — `targetOutputs[3]` (reports)
- `process.tpl.tengo:251` — `exportOutputs[0]` (clonotypeTable)
- `process.tpl.tengo:309` — `aggregationOutputs[0]` (clonotypeProperties)
- `calculate-export-specs.lib.tengo:1059` — `axesByClonotypeKey[0].spec.domain` (clonotypeKey axis)

### 1.3 Trace IDs Containing `blockId`

- `process.tpl.tengo:212` — `traceSteps: [{..., id: blockId, ...}]` in `pframes.processColumn` call for `mixcrAnalyzeTpl`
- `process.tpl.tengo:335` — `traceSteps: [{..., id: blockId + "." + chains, ...}]` in `pframes.processColumn` call for `aggregateByClonotypeKeyTpl`

### 1.4 `sampleIdAxisSpec` (Per-Dataset Value)

**Source:** `process.tpl.tengo:86` — `sampleIdAxisSpec := inputSpec.axesSpec[0]`

This is the sampleId axis spec from the upstream input dataset. It varies between block instances if they use different input datasets. Crucially, it is passed as a pure-template input:

- `process.tpl.tengo:359` — `sampleIdAxisSpec: sampleIdAxisSpec` inside `render.create(exportReportTpl, {...})`
- `export-report.tpl.tengo:29` — read as `sampleIdAxisSpec := inputs.sampleIdAxisSpec`
- `export-report.tpl.tengo:338` — passed to `qcReportColumns(hasUmi, sampleIdAxisSpec, chains, umiTags)` which embeds it in `reportColumnsSpec.axes[0].spec`
- `export-report.tpl.tengo:341–346` — `xsv.importFile(tsvFile, "tsv", reportColumnsSpec, {...})` — the `reportColumnsSpec` (with `sampleIdAxisSpec` baked into `axes[0].spec`) goes directly into `xsv.importFile` without `splitDataAndSpec: true`
- `qc-report-columns.lib.tengo:830–833` — `axes := [{ column: "sampleId", spec: sampleIdAxisSpec }]`

### 1.5 `pl7.app/vdj/libraryId: blockId` (mode=`libraryFile` only)

**Source:** `main.tpl.tengo:177`

This is in the `exports` return map (direct spec stamping in `wf.body`), not inside a pure template. It is CID-safe because it's in the top-level ephemeral body. Noted for completeness; no action needed.

---

## 2. CID-Affecting Path Inventory

### 2.1 `pframes.processColumn` — First Call (MiXCR analyze)

**File:Line:** `process.tpl.tengo:197–237`

```tengo
mixcrResults := pframes.processColumn(
    { spec: inputSpec, data: inputs.inputData },
    mixcrAnalyzeTpl,
    targetOutputs,
    {
        aggregate: [...],
        passAggregationAxesNames: true,
        traceSteps: [{type: "milaboratories.mixcr-amplicon-alignment", id: blockId, importance: 20, label: "MiXCR generic amplicon"}],
        extra: { params: maps.clone({...}, { removeUndefs: true }), limitInput: limitInput },
        metaExtra: { perProcessMemGB: perProcessMemGB, perProcessCPUs: perProcessCPUs }
    }
)
```

**Context:** Called inside `process.tpl.tengo` which is **ephemeral** (`self.awaitState("InputsLocked")`, line 22). Per-instance domains in `targetOutputs` (lines 140, 150, 161, 174) and per-instance id in `traceSteps` (line 212) are **inside an ephemeral template** — no CID is computed for the ephemeral boundary itself.

**Does per-instance state flow into a pure CID?** The `traceSteps` and the domain specs in `targetOutputs` ARE used by `pframes.processColumn` / `process-pcolumn-data.tpl.tengo` to build inner `render.create(mixcrAnalyzeTpl, renderInputs)` calls that ARE pure. Specifically:

- `traceSteps[0].id = blockId` → the SDK `index.lib.tengo` consumes `traceSteps` to inject trace into output specs AFTER the inner render returns. The `traceSteps` field is passed through to `process-pcolumn-data.tpl.tengo` via the options object, which eventually calls `common.buildOutputTrace(opts, output, input.spec)`. This happens outside the inner render (the trace is injected by stripping `traceSteps` from the processed output dict before it reaches `render.createUniversal` — as confirmed by `index.lib.tengo`'s behavior of removing `traceSteps` and `spec` from `processedOutputs` before the render). **So `traceSteps` does NOT flow into the pure inner render CID.** The `id: blockId` in `traceSteps` is safe.

- `targetOutputs` domain specs WITH `blockId` (lines 140, 150, 161, 174) — these are output spec declarations. The SDK strips the `spec` field from `processedOutputs` before constructing `renderInputs` (evidenced by `processedOutputs = append(processedOutputs, maps.merge(output, {spec: undefined, traceSteps: undefined, overrideTrace: undefined}))` in `index.lib.tengo`). Therefore domain values in `targetOutputs[*].spec` do NOT flow into the per-sample `render.create(mixcrAnalyzeTpl, ...)` CID. **Safe.**

**Verdict for call 1:** No active CID leak through this callsite. The ephemeral boundary + SDK stripping protects it.

### 2.2 `pframes.processColumn` — Second Call (MiXCR export)

**File:Line:** `process.tpl.tengo:272–296`

```tengo
exportResults := pframes.processColumn(
    mixcrResults.output("clns"),
    mixcrExportTpl,
    exportOutputs,   // line 245-270 — exportOutputs[0] has blockId in domain (line 251)
    {
        extra: { params: maps.clone({clonotypeKeyColumns: clonotypeKeyColumns, ...}) },
        metaExtra: { perProcessMemGB: perProcessMemGB }
    }
)
```

**Per-instance state in inputs:**
- `exportOutputs[0]` (clonotypeTable) has `domain: {"pl7.app/vdj/clonotypingRunId": blockId}` at line 251 — same analysis as §2.1 applies: SDK strips `spec` from `processedOutputs` before `render.createUniversal`. **Safe.**
- `exportOutputs[1]` (byCloneKeyBySample, `Xsv` type) uses `axesByClonotypeKeyWithChain` (line 261). The `axesByClonotypeKeyWithChain` is derived from `axesByClonotypeKey` (line 239–241) which was built by `calculateExportSpecs(presetSpecForBack, blockId)`. It carries `"pl7.app/vdj/clonotypingRunId": blockId` in the clonotypeKey axis spec domain.

For `Xsv`-type outputs, the SDK decomposes the `settings` (including `axes` with their full specs) via `pUtil.decomposePfconvImportCfg(output.settings, {...})`. The `purifiedPfconvCfg` goes into `renderInputs`, and the `columnsSpec` is separated out and injected onto the output spec AFTER the render. **Whether `blockId` in `axesByClonotypeKeyWithChain[0].spec.domain` ends up in `purifiedPfconvCfg` or in `columnsSpec` determines if it's CID-affecting.**

This is a **confirmed CID-affecting path**: `cid-investigation-2-2026-05-21.md` §2b explicitly traces the F1b error to `aggregates` output whose axis spec carried `blockId`. The `byCloneKeyBySample` Xsv output follows the same pattern.

**Verdict for call 2:** The `Xsv` output targets (`byCloneKeyBySample`) contain `axesByClonotypeKeyWithChain` which embeds `"pl7.app/vdj/clonotypingRunId": blockId`. **CONFIRMED LEAK.**

### 2.3 `pframes.processColumn` — Third Call (Aggregate by clonotype key)

**File:Line:** `process.tpl.tengo:329–350`

```tengo
aggregationResults := pframes.processColumn(
    exportResults.output("clonotypeTable"),
    aggregateByClonotypeKeyTpl,
    aggregationOutputs,   // aggregationOutputs[1] is Xsv at line 316-327
    {
        aggregate: ["pl7.app/sampleId"],
        traceSteps: [{type: "...", id: blockId + "." + chains, importance: 150, label: "Aggregate " + chains}],
        extra: { params: {...} }
    }
)
```

**Per-instance state in inputs:**
- `traceSteps[0].id = blockId + "." + chains` at line 335 — same SDK stripping applies as in §2.1. **Safe.**
- `aggregationOutputs[0]` (clonotypeProperties, Resource) — `domain: {"pl7.app/vdj/clonotypingRunId": blockId}` at line 309. SDK strips spec. **Safe.**
- `aggregationOutputs[1]` (aggregates, `Xsv` type) — line 316–327 — uses `axesByClonotypeKeyWithChain` (same as §2.2) with `blockId` embedded. **CONFIRMED LEAK.**

The F1b error reported in `cid-investigation-2-2026-05-21.md` points directly to `clones.clonotypeProperties/aggregates/IGHeavy/best-v-hit-with-allele.data → clns → RenderTemplate:1` — this is this callsite's `aggregates` Xsv output.

**Verdict for call 3:** The `aggregates` Xsv output target has `axesByClonotypeKeyWithChain` with `blockId` in axis domain. **CONFIRMED LEAK (primary leak causing F1b errors).**

### 2.4 `render.create(exportReportTpl, ...)` — Pure Template Call

**File:Line:** `process.tpl.tengo:357–370`

```tengo
qcReportTable := render.create(exportReportTpl, {
    clnsData: mixcrResults.outputData("clns"),
    sampleIdAxisSpec: sampleIdAxisSpec,       // ← per-dataset value in pure inputs
    chains: [chains],
    library: referenceLibrary,
    isLibraryFileGzipped: params.isLibraryFileGzipped,
    clonotypeTablesData: clonotypeTablesData,  // ← PColumnData map (see §4.2)
    hasUmi: hasUMI,
    umiTags: umiTags,
    perProcessMemGB: perProcessMemGB,
    productiveFeature: productiveFeature,
    stopCodonTypes: params.stopCodonTypes,
    stopCodonReplacements: params.stopCodonReplacements
})
```

**Note:** `render.create` (NOT `render.createEphemeral`) — this IS a pure, CID-bearing render template.

**Per-instance state in inputs:**
1. `sampleIdAxisSpec` — carries per-dataset identity (from `inputSpec.axesSpec[0]`). While NOT `blockId` directly, this value varies between block instances using different input datasets. More importantly, it flows through `qcReportColumns()` and ends up in `reportColumnsSpec.axes[0].spec`, then into `xsv.importFile` without `splitDataAndSpec: true`. This means the axis spec (including whatever domain the dataset's sampleId axis carries) is baked into the CID of the xsv import resource. **CONFIRMED LEAK (secondary, varies by input dataset rather than blockId).**

2. `clonotypeTablesData` — a Tengo map of `PColumnData` resources (see §4.2 for safety analysis).

3. `perProcessMemGB` — a per-instance tuning value. Should be `metaInputs`, not a pure input. If it differs between two block instances running identical data but different memory settings, it produces different CIDs. **CONFIRMED LEAK (minor; dedup correctness bug rather than conflict).**

**Inside `export-report.tpl.tengo`:**

```tengo
// export-report.tpl.tengo:19
self.defineOutputs("qcReportTable")  // ← PURE template (not ephemeral)

// export-report.tpl.tengo:341–346
qcReportTable := xsv.importFile(
    tsvFile,
    "tsv",
    reportColumnsSpec,   // built from sampleIdAxisSpec — per-dataset
    { cpu: 1, mem: "16GiB" }  // ← no splitDataAndSpec: true
)
```

The missing `splitDataAndSpec: true` means the axis spec (with per-dataset values) goes directly into the `xsv.importFile` exec's input resources, making the CID per-instance. **CONFIRMED LEAK.**

**Verdict for call 4:** This is the primary pure-template CID conflict. Two leaks:
- `sampleIdAxisSpec` in pure template inputs (per-dataset identity baked into CID)
- `perProcessMemGB` in pure template inputs (per-instance tuning in CID)
- `xsv.importFile` without `splitDataAndSpec: true` inside a pure template body

### 2.5 `xsv.importFile` inside `export-report.tpl.tengo`

**File:Line:** `export-report.tpl.tengo:341–346`

Already covered in §2.4. The `reportColumnsSpec` built from `sampleIdAxisSpec` lacks `splitDataAndSpec: true`. Per the deduplication-deep-dive Part 5 §4 pattern, this is exactly the anti-pattern: stamping per-instance/per-dataset axis specs into `xsv.importFile` before the call instead of after.

---

## 3. Spec Stamping Plan

For each output that currently embeds per-instance state, here is what needs stamping after the pure call returns.

### 3.1 `byCloneKeyBySample` and `aggregates` (Xsv outputs of `pframes.processColumn`)

**Current:** `axesByClonotypeKeyWithChain[0].spec.domain["pl7.app/vdj/clonotypingRunId"] = blockId` flows into the Xsv output settings going into the pure inner render.

**Fix pattern:** Strip `blockId` from `axesByClonotypeKey` before passing to `calculateExportSpecs`. Make `calculateExportSpecs` produce axis specs without any `clonotypingRunId` domain entry. After `pframes.processColumn` returns, stamp the domain on the returned spec before adding to `pFrameBuilder`:

```tengo
// Instead of letting pframes.processColumn stamp the domain via Xsv settings,
// use addXsvOutputToBuilder's spec-override capability (or post-process the spec):
canonicalAxesByClonotypeKey = calculateExportSpecsWithoutBlockId(presetSpecForBack)
// ... run pframes.processColumn with canonical axes ...
exportedByCloneKeySpec := exportResults.outputSpec("byCloneKeyBySample")
// Stamp blockId and trace onto returned spec:
stampedSpec := pSpec.cloneSpec(exportedByCloneKeySpec, {
    "pl7.app/vdj/clonotypingRunId": blockId
}, undefined)
clones.add("clonotypeProperties/bySample/" + chains + "/", trace.inject(stampedSpec), exportResults.outputData("byCloneKeyBySample"))
```

The same pattern applies to `aggregates`:

```tengo
stampedAggregatesSpec := pSpec.cloneSpec(aggregationResults.outputSpec("aggregates"), {
    "pl7.app/vdj/clonotypingRunId": blockId
}, undefined)
clones.add("clonotypeProperties/aggregates/" + chains + "/", trace.inject(stampedAggregatesSpec), aggregationResults.outputData("aggregates"))
```

**Note:** `addXsvOutputToBuilder` is a convenience that currently does the `pFrameBuilder.add` internally. To post-stamp the spec, this call must be replaced with a manual `clones.add(path, stampedSpec, data)` pattern. The titeseq `buildTracedPf` function (lines 404–420) is the canonical model.

### 3.2 `qcReportTable` (`xsv.importFile` inside `export-report.tpl.tengo`)

**Fix pattern (preferred — matches investigation §2.4 Option A):**

1. Change `export-report.tpl.tengo` from pure to ephemeral:
   ```tengo
   // Remove: self.defineOutputs("qcReportTable")
   // Add:
   self.awaitState("AllInputsSet")
   ```

2. Move `sampleIdAxisSpec` and `perProcessMemGB` out of the `render.create` input map in `process.tpl.tengo` (line 357):
   - Pass `sampleIdAxisSpec` via `metaInputs` (it's needed inside the template to stamp onto the returned spec)
   - Pass `perProcessMemGB` via `metaInputs` (it only affects resource allocation, not content)

3. Inside `export-report.tpl.tengo`, add `splitDataAndSpec: true` to `xsv.importFile`:
   ```tengo
   qcReportResult := xsv.importFile(
       tsvFile,
       "tsv",
       reportColumnsSpecCanonical,   // axes with NO per-instance domain
       { cpu: 1, mem: "16GiB", splitDataAndSpec: true }
   )
   ```

4. Stamp `sampleIdAxisSpec` onto the returned spec:
   ```tengo
   // After importFile returns:
   finalSpec := pSpec.cloneSpec(qcReportResult.spec, {
       // inject the axis spec override for sampleId
   }, undefined)
   ```

   **Alternative (simpler):** Because `sampleIdAxisSpec` is the full axis spec (not just a domain value), the stamping requires the SDK's `pSpec` utilities. Inspect what titeseq's `cloneSpec` accepts — if it only stamps domain fields, the axis spec override may need a different approach. Consult the `pframes.spec` module API.

**Fix pattern (minimal — Option B):** Keep `export-report.tpl.tengo` pure but move the `render.create` in `process.tpl.tengo` to `render.createEphemeral`. This resolves the outer CID conflict but leaves `sampleIdAxisSpec` inside the import spec — a violation of PR9 principles that may cause future conflicts (see §4.2 for the constraint on why we cannot simply use `createEphemeral`).

### 3.3 `clonotypeKey` Axis Domain (`pl7.app/vdj/clonotypingRunId` in `axesByClonotypeKey`)

**Source:** `calculate-export-specs.lib.tengo:1059`

The function signature is `calculateExportSpecs(presetSpecForBack, blockId)` — `blockId` is a direct param. 

**Fix:** Add a new variant `calculateExportSpecsCanonical(presetSpecForBack)` that produces `axesByClonotypeKey` without `"pl7.app/vdj/clonotypingRunId"` in the domain. Stamp the domain AFTER the `pframes.processColumn` calls return, when building the final `pFrameBuilder` entries (as described in §3.1).

Alternatively, pass `blockId` to `calculateExportSpecs` only for the non-CID-affecting paths (where it is needed for SDK trace, not for `Xsv` settings), and produce a separate `canonicalAxesByClonotypeKey` without it for Xsv output settings.

---

## 4. Risk Callouts

### 4.1 `clonotypingRunId` Is Structurally Necessary in Final Specs

The `"pl7.app/vdj/clonotypingRunId": blockId` domain value IS required on the output PColumn specs so that downstream blocks (UI, Lead Selection, etc.) can identify which run produced each column. Removing it from the FINAL spec would break the link.

**This is NOT a blocker.** The fix is to remove it from the INPUTS to the pure template (so deduplication works), and add it back to the OUTPUT specs after the pure work completes. The data resource is unchanged; only the spec resource changes.

Specifically: `addXsvOutputToBuilder(clones, "aggregates", path)` currently does the spec attachment. After the fix, you call `clones.add(path, stampedSpec, data)` directly with `stampedSpec` having the domain restored. The data path is identical; only the spec CID differs (correctly, per-instance).

### 4.2 `clonotypeTablesData` Passed Across Pure Template Boundary

**Finding:** `clonotypeTablesData` is a Tengo map of `PColumnData` resources:

```tengo
// process.tpl.tengo:299-300
clonotypeTablesData := {}
clonotypeTablesData[chains] = exportResults.outputData("clonotypeTable")
```

It is then passed as a direct input to `render.create(exportReportTpl, { ..., clonotypeTablesData: clonotypeTablesData, ... })`.

Inside `export-report.tpl.tengo`, `clonotypeTablesData` is consumed at lines 177–196 via `chainData := clonotypeTablesData[chain]` and then `chainData.inputs()` is called to iterate over the per-sample files for counting clonotypes.

**The constraint from the previous regression:** The reverted commit `10fe263` switched this to `render.createEphemeral`. The regression caused `chainData.inputs()` to fail — PColumnData objects cannot be resolved inside an ephemeral template through the `.inputs()` call, because `.inputs()` requires the backend to have settled the referenced resources into a stable state that isn't guaranteed in ephemeral context.

**Current V1 shape uses `render.create` (pure).** The template body calls `chainData.inputs()` at line 177+ of `export-report.tpl.tengo`. This works in the current pure-body shape because the pure render waits for all inputs to be resolved before executing the body.

**Constraint for the fix:** The PR9 fix MUST NOT switch `export-report.tpl.tengo` back to a body that calls `chainData.inputs()` in an ephemeral context. If Option A is chosen (making `export-report.tpl.tengo` ephemeral), the `clonotypeTablesData`/`chainData.inputs()` pattern must either:
1. Be refactored so the counting happens outside the ephemeral template (e.g., computed in `process.tpl.tengo` before the call, passed as pre-computed counts), OR
2. Be moved to a separate pure child template that receives `clonotypeTablesData` as a resolved input and returns counts, so that the ephemeral parent only handles spec stamping.

Option B (`render.createEphemeral` at the call site in `process.tpl.tengo`) inherits this same issue: `clonotypeTablesData` as a map of PColumnData resources would be passed to an ephemeral template that calls `.inputs()` on them. **Option B is therefore also problematic unless the `.inputs()` issue is resolved.**

**Recommended safe path:** Keep `export-report.tpl.tengo` pure (keep `self.defineOutputs`) but strip CID-affecting per-instance state from its inputs using `metaInputs`. Specifically:
- Move `sampleIdAxisSpec` → `metaInputs`
- Move `perProcessMemGB` → `metaInputs`
- Add `splitDataAndSpec: true` to `xsv.importFile` inside the template
- Stamp `sampleIdAxisSpec` onto the returned spec INSIDE the template body (this is legal inside a pure template — `metaInputs` values are accessible inside the body)

This approach doesn't change the `render.create` vs `render.createEphemeral` distinction, avoids the `.inputs()` regression, and applies the PR9 pattern correctly.

---

## 5. Complete Leak Summary Table

| Leak # | Location | State | Flows into CID? | Severity |
|--------|----------|-------|-----------------|----------|
| L1 | `process.tpl.tengo:212` | `blockId` in `traceSteps[0].id` | NO — SDK strips traceSteps before inner render | Safe |
| L2 | `process.tpl.tengo:335` | `blockId + "." + chains` in `traceSteps[0].id` | NO — SDK strips traceSteps before inner render | Safe |
| L3 | `process.tpl.tengo:140,150,161,174` | `blockId` in `targetOutputs[*].spec.domain` | NO — SDK strips spec from processedOutputs before render | Safe |
| L4 | `process.tpl.tengo:251` | `blockId` in `exportOutputs[0].spec.domain` | NO — Resource-type output, spec stripped | Safe |
| **L5** | `process.tpl.tengo:259–269` + `calculate-export-specs.lib.tengo:1059` | `blockId` in `exportOutputs[1]` (Xsv) `axes[0].spec.domain` | **YES — Xsv axes domain flows into purifiedPfconvCfg** | **CRITICAL** |
| L6 | `process.tpl.tengo:309` | `blockId` in `aggregationOutputs[0].spec.domain` | NO — Resource-type output, spec stripped | Safe |
| **L7** | `process.tpl.tengo:316–327` + `calculate-export-specs.lib.tengo:1059` | `blockId` in `aggregationOutputs[1]` (Xsv) `axes[0].spec.domain` | **YES — Xsv axes domain flows into purifiedPfconvCfg** | **CRITICAL (primary F1b cause)** |
| **L8** | `process.tpl.tengo:357–370` | `sampleIdAxisSpec` in `render.create(exportReportTpl, ...)` pure inputs | **YES — per-dataset value in pure template CID** | **HIGH** |
| **L9** | `process.tpl.tengo:366` | `perProcessMemGB` in `render.create(exportReportTpl, ...)` pure inputs | **YES — per-instance tuning in pure template CID** | **MEDIUM** |
| **L10** | `export-report.tpl.tengo:341–346` | `reportColumnsSpec` (with `sampleIdAxisSpec`) in `xsv.importFile` without `splitDataAndSpec: true` | **YES — axis spec baked into exec CID** | **HIGH** |
| L11 | `main.tpl.tengo:177` | `blockId` in `exports.library.spec.domain` | NO — in wf.body (ephemeral), not in pure template | Safe |

**Active leaks requiring fix: L5, L7, L8, L9, L10**

---

## 6. Recommended Commit Order

### Commit A — Strip `blockId` from `axesByClonotypeKey` axis domain (L5, L7)

**Files:** `workflow/src/calculate-export-specs.lib.tengo`, `workflow/src/process.tpl.tengo`

- In `calculate-export-specs.lib.tengo`: remove `"pl7.app/vdj/clonotypingRunId": blockId` from `axesByClonotypeKey[0].spec.domain` (line 1059). Remove the `blockId` parameter from `calculateExportSpecs` if it's only used for this field (verify first — it may be used elsewhere in the function).
- In `process.tpl.tengo`: update the call `calculateExportSpecs(presetSpecForBack, blockId)` accordingly.
- Replace `exportResults.addXsvOutputToBuilder(clones, "byCloneKeyBySample", ...)` and `aggregationResults.addXsvOutputToBuilder(clones, "aggregates", ...)` with manual `clones.add(path, stampedSpec, data)` calls that stamp `"pl7.app/vdj/clonotypingRunId": blockId` onto the returned specs.
- Import `pSpec` in `process.tpl.tengo` (add `pSpec := import("@platforma-sdk/workflow-tengo:pframes.spec")`).

**Verifiable:** Run tests — the `CIDConflictError` on the `aggregates` path should disappear.

### Commit B — Move `perProcessMemGB` out of `render.create(exportReportTpl, ...)` (L9)

**Files:** `workflow/src/process.tpl.tengo`, `workflow/src/export-report.tpl.tengo`

- In `process.tpl.tengo` line 357–370: move `perProcessMemGB: perProcessMemGB` from the main inputs map to `metaInputs`:
  ```tengo
  qcReportTable := render.create(exportReportTpl, {
      clnsData: ..., sampleIdAxisSpec: sampleIdAxisSpec, ...
  }, {
      metaInputs: { perProcessMemGB: perProcessMemGB }
  })
  ```
- In `export-report.tpl.tengo`: `inputs.perProcessMemGB` continues to work — `metaInputs` are accessible inside the body.

**Verifiable:** Rebuild, check two instances with different memory settings produce the same CID for the export-report template.

### Commit C — Strip `sampleIdAxisSpec` from pure inputs; add `splitDataAndSpec: true` (L8, L10)

**Files:** `workflow/src/process.tpl.tengo`, `workflow/src/export-report.tpl.tengo`

- In `process.tpl.tengo` line 357–370: move `sampleIdAxisSpec: sampleIdAxisSpec` to `metaInputs`.
- In `export-report.tpl.tengo`:
  - Build `reportColumnsSpec` WITHOUT the `sampleIdAxisSpec` in the axis spec (use a canonical placeholder axis or pass the axis name only).
  - Add `splitDataAndSpec: true` to `xsv.importFile`.
  - After `xsv.importFile` returns, stamp `sampleIdAxisSpec` onto the returned spec using `pSpec` utilities.

**Constraint:** Confirm that the `sampleIdAxisSpec` stamping on `qcReportTable` output spec works via `metaInputs` access inside the pure body. This is valid per `render.lib.tengo` docs: `metaInputs` are not in dedup, but ARE accessible inside the body function.

**Verifiable:** Two block instances using the same input dataset now produce the same `export-report` CID.

### Commit D — Add `hash_override` (optional, post-stabilization)

Once all tests pass consistently across multi-instance runs, add a `hash_override` to freeze the stable state.

---

## 7. Files to Modify (Summary)

| File | Changes |
|------|---------|
| `workflow/src/calculate-export-specs.lib.tengo` | Remove `blockId` from `axesByClonotypeKey` axis domain (line 1059); possibly remove `blockId` param from function signature |
| `workflow/src/process.tpl.tengo` | Update `calculateExportSpecs` call; replace `addXsvOutputToBuilder` with manual `clones.add` + spec stamping; move `sampleIdAxisSpec` and `perProcessMemGB` to `metaInputs` in `render.create(exportReportTpl, ...)` |
| `workflow/src/export-report.tpl.tengo` | Add `splitDataAndSpec: true` to `xsv.importFile`; build canonical axis spec without per-dataset values; stamp returned spec with `sampleIdAxisSpec` from `metaInputs` |

**Files NOT to change:**
- `aggregate-by-clonotype-key.tpl.tengo` — pure, no per-instance inputs (only `params` and `inputs[VALUE_FIELD_NAME]`)
- `qc-report-columns.lib.tengo` — pure lib, no blockId
- `main.tpl.tengo` — blockId in `exports.library.spec` is safe (ephemeral body)

---

## 8. References

- `cid-investigation-2026-05-21.md` — first investigation, identified export-report as conflict site
- `cid-investigation-2-2026-05-21.md` §2b — confirmed `aggregates` path as F1b source, `blockId` in `axesByClonotypeKey` as root
- `personal-notes/cid-conflicts-deep-dive.md` Part 1 (PR9 mechanism), Part 5 §4 (canonical patch shape checklist)
- `personal-notes/deduplication-deep-dive.md` Part 5 (`xsv.importFile` worked example), Part 6 §6 (block author checklist)
- `blocks/titeseq-analysis/workflow/src/main.tpl.tengo` — PR9 reference: `splitDataAndSpec: true` (line 316, 375), `pSpec.makeTrace` (line 398), `buildTracedPf` function (lines 404–420), `pfb.add(k, trace.inject(v.spec), v.data)` (line 416)
- SDK source for stripping behavior: `core/platforma/sdk/workflow-tengo/src/pframes/index.lib.tengo` (processedOutputs stripping of `spec`, `traceSteps`, `overrideTrace`)
