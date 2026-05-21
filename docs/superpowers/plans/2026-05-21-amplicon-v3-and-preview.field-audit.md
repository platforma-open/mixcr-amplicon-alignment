# Phase 0 — Field channel audit for MILAB-6069

**Date:** 2026-05-21
**Plan:** docs/superpowers/plans/2026-05-21-amplicon-v3-and-preview.md
**Reference:** harnesses/block-dev/model-v1-to-v3-migration.md (Phase 0)

## Channels (reference)

| Channel | Trigger | Rule |
|---|---|---|
| `args` | Run button (stale gate) | Committed analysis decisions; staling on change is correct |
| `prerunArgs` | Auto-rerun (no user gate) | Discovery / staging / always-live state |
| `data`-only | none (UI state) | UI ephemeral state; never reaches workflow |

---

## BlockArgs fields (from model/src/args.ts)

All fields in `BlockArgs` (args.ts:38–64). Each row cites the specific template:line that reads it.

| Field | Type | Read by `main.tpl.tengo` | Read by `prerun.tpl.tengo` | V3 channel | Notes / canonicalization |
|---|---|---|---|---|---|
| `defaultBlockLabel` | `string?` | no | no | `data`-only | Written by UI (`watchEffect` in MainPage.vue:62); read by `.subtitle()` in index.ts:253. Never sent to workflow. |
| `customBlockLabel` | `string?` | no | no | `data`-only | User-typed label override; read by `.subtitle()` in index.ts:253. Never sent to workflow. |
| `datasetRef` | `PlRef?` | line 27 (`inputRef := args.datasetRef`) | no | `args` | Required; throw if undefined. Staling on change is correct — data analysis must be redone. |
| `chains` | `string?` | line 31 (`chains := args.chains`) | line 20 (`chains := chainInfos[args.chains]`) | `args` + `prerunArgs` | Read by both templates. In `args`: drives MiXCR chain filter. In `prerunArgs`: drives repseqio buildLibrary. Declare in `args` return and also in `prerunArgs` return. |
| `title` | `string?` | no | no | `data`-only | Not read by any workflow template (confirmed by grep). Candidate for removal from `BlockArgs` — no workflow use found. |
| `tagPattern` | `string` | line 143 (`tagPattern: args.tagPattern`) via params JSON | no | `args` | Canonicalize: strip leading/trailing whitespace before projecting. Empty string is a valid "no pattern". |
| `vGenes` | `string?` | line 121 (`vGenes: args.vGenes`) — only when `mode != "buildLibrary" && mode != "libraryFile"` | no | `args` | Used for fastaSequence / fastaFile reference modes. |
| `jGenes` | `string?` | line 122 (`jGenes: args.jGenes`) — only when `mode != "buildLibrary" && mode != "libraryFile"` | no | `args` | Used for fastaSequence / fastaFile reference modes. |
| `limitInput` | `number?` | line 32 (`limitInput := args.limitInput`) | no | `args` (conditional) | Conditional on `runMode`: omit when `runMode === 'full'` so stale dry-run value never leaks into Full run. Positive integer required when `runMode === 'dry'`. |
| `perProcessMemGB` | `number?` | line 33 (`perProcessMemGB := args.perProcessMemGB`) | no | `args` | Resource sizing; changing it must re-run (staling correct). |
| `perProcessCPUs` | `number?` | line 34 (`perProcessCPUs := args.perProcessCPUs`) | no | `args` | Resource sizing; changing it must re-run (staling correct). |
| `cloneClusteringMode` | `CloneClusteringMode?` | line 35 (`cloneClusteringMode := args.cloneClusteringMode`) | no | `args` | Analysis decision; staling correct. |
| `assemblingFeature` | `AssemblingFeature?` | line 144 (`assemblingFeature: args.assemblingFeature`) via params JSON | no | `args` | Analysis decision. |
| `badQualityThreshold` | `number?` | line 146 (`badQualityThreshold: args.badQualityThreshold`) via params JSON | no | `args` | Analysis decision. |
| `disableLowQualityMapping` | `boolean?` | line 147 (`disableLowQualityMapping: args.disableLowQualityMapping`) via params JSON | no | `args` | Analysis decision. |
| `stopCodonTypes` | `StopCodonType[]?` | line 149 (`stopCodonTypes: args.stopCodonTypes`) via params JSON | no | `args` | Analysis decision. |
| `stopCodonReplacements` | `StopCodonReplacements?` | line 150 (`stopCodonReplacements: args.stopCodonReplacements`) via params JSON | no | `args` | Analysis decision. |
| `referenceFileHandle` | `ImportFileHandle?` | no | no | `data`-only | **Not read by any workflow template.** Candidate for removal. Possibly a dead field from an earlier design iteration. Flag for verification before Task 3. |
| `libraryFile` | `ImportFileHandle?` | line 115 (`fImport := file.importFile(args.libraryFile)`) — only when `mode == "libraryFile"` | no | `args` | Used in libraryFile mode. |
| `isLibraryFileGzipped` | `boolean?` | line 148 (`isLibraryFileGzipped: params.isLibraryFileGzipped`) via params JSON | no | `args` | Companion to `libraryFile`. |
| `imputeGermline` | `boolean?` | line 145 (`imputeGermline: args.imputeGermline`) via params JSON | no | `args` | Analysis decision. |
| `libraryEntries` | `LibraryEntryDefinition[]?` | line 62 (`for entry in args.libraryEntries`) — only when `mode == "buildLibrary"` | no | `args` | Structured entry definitions for buildLibrary mode (the _result_ of the build-library workflow, not its inputs). |
| `buildLibraryVGenes` | `string?` | no | line 23 (`vGenes: args.buildLibraryVGenes`) | `prerunArgs` | Discovery input for repseqio. User pastes FASTA; should auto-rerun without Run prompt. |
| `buildLibraryJGenes` | `string?` | no | line 24 (`jGenes: args.buildLibraryJGenes`) | `prerunArgs` | Discovery input for repseqio. User pastes FASTA; should auto-rerun without Run prompt. |
| `referenceInputMode` | `ReferenceInputMode?` | line 52 (`mode := args.referenceInputMode`) | line 11 (`if args.referenceInputMode == "buildLibrary"`) | `args` + `prerunArgs` | Read by both templates. In `main`: selects the reference-build code path. In `prerun`: gates the buildLibrary repseqio run. Must appear in both lambda return objects. |

> **Note on `params` passthrough:** `main.tpl.tengo` constructs a `params` JSON resource (lines 136–151) and passes it to `process.tpl.tengo`. Fields passed via `params` are effectively part of `args` — `process.tpl.tengo` reads them from `inputs.params.*`, not from `args` directly. They are all read by main and must be in the `.args` return.

---

## BlockData UI-only fields (from model/src/index.ts:31–40)

These fields appear in `BlockData` but not in `BlockArgs`. They are stored in platform state but the workflow never reads them.

| Field | Type | Workflow reads? | V3 channel | Notes |
|---|---|---|---|---|
| `referenceInputMode` | `ReferenceInputMode?` | yes — duplicated here from `BlockArgs` | see BlockArgs table | Present in both `BlockArgs` (workflow reads it) and `BlockData` (via `BlockArgs &`). This row is a reminder that it is NOT data-only despite being listed in `BlockData`. |
| `librarySequence` | `string?` | no | `data`-only | Text-area content for fastaSequence mode. UI reads it for display; workflow does not. Already excluded from `.args` projection in index.ts:88. |
| `selectedRecordHeaders` | `string[]?` | no | `data`-only | UI column-selection state. Already excluded from `.args` projection in index.ts:90. |
| `buildLibraryFastaFile` | `ImportFileHandle?` | no | `data`-only | Staged file handle for the build-library FASTA upload. Workflow uses `buildLibraryVGenes`/`buildLibraryJGenes` (the extracted strings), not the raw handle. Already excluded from `.args` projection in index.ts:92. |
| `tableState` | `PlDataTableStateV2` | no | `data`-only | AG-Grid table display state (sort, filters). Already excluded from `.args` projection in index.ts:86. |
| `runMode` | `'dry' \| 'full'` | no | `data`-only (drives args canonicalization) | NOT projected into args itself. Used inside `.args` lambda to decide whether `limitInput` is included in the projection. Already excluded from `.args` projection in index.ts:94. |

---

## Fields claimed in task spec as "sitting in BlockData" — clarification

The task description also lists: `logsOpen`, `settingsOpen`, `sampleReportOpen`, `selectedSample`. These are **not** in `BlockData`. They are pure Vue `reactive()` locals in `MainPage.vue:76–86` and are never persisted to platform state at all. No action required for V3 migration.

---

## Scope test outcome

**For each `args`-channel field: does staling on change make sense to the user?**

| Field | Stale on change? | Verdict |
|---|---|---|
| `datasetRef` | yes — completely different data | correct |
| `chains` | yes — different alignment target | correct |
| `tagPattern` | yes — determines UMI/tag extraction | correct |
| `vGenes` / `jGenes` | yes — reference library rebuilt | correct |
| `limitInput` | yes, when dry; suppressed when full | correct (conditional) |
| `perProcessMemGB` / `perProcessCPUs` | yes — resource override affects job | correct |
| `cloneClusteringMode` | yes — clonotype merging changes results | correct |
| `assemblingFeature` | yes | correct |
| `badQualityThreshold` | yes | correct |
| `disableLowQualityMapping` | yes | correct |
| `stopCodonTypes` / `stopCodonReplacements` | yes | correct |
| `libraryFile` / `isLibraryFileGzipped` | yes — reference file changed | correct |
| `imputeGermline` | yes | correct |
| `libraryEntries` | yes — structured library changed | correct |
| `referenceInputMode` | yes — changes the whole reference path | correct |

**For each `prerunArgs`-channel field: does the user expect it to "just be current" without a Run prompt?**

| Field | Auto-rerun correct? | Verdict |
|---|---|---|
| `referenceInputMode` | yes — switching mode should immediately update prerun state | correct |
| `chains` | yes — chain switch updates prerun library | correct |
| `buildLibraryVGenes` | yes — paste FASTA → library rebuilds live | correct |
| `buildLibraryJGenes` | yes — same as above | correct |

**For each `data`-only field: is it really never read by the workflow?**

| Field | Workflow reads? | Verdict |
|---|---|---|
| `defaultBlockLabel` | no (confirmed by grep) | correct |
| `customBlockLabel` | no (confirmed by grep) | correct |
| `title` | no (confirmed by grep) | correct — also dead in BlockArgs, candidate for removal |
| `referenceFileHandle` | no (confirmed by grep) | correct — dead in BlockArgs, candidate for removal |
| `librarySequence` | no | correct |
| `selectedRecordHeaders` | no | correct |
| `buildLibraryFastaFile` | no | correct |
| `tableState` | no | correct |
| `runMode` | no | correct |

---

## Conclusions for Task 3 (`.args`)

The `.args` lambda should return these fields (projected from `BlockData`):

```
datasetRef, chains, tagPattern (whitespace-stripped), vGenes, jGenes,
limitInput (conditional), perProcessMemGB, perProcessCPUs, cloneClusteringMode,
assemblingFeature, badQualityThreshold, disableLowQualityMapping,
stopCodonTypes, stopCodonReplacements, referenceInputMode,
libraryFile, isLibraryFileGzipped, imputeGermline, libraryEntries
```

**Fields to explicitly exclude** (currently excluded by destructuring in index.ts:84–96, keep that approach):
`tableState`, `librarySequence`, `selectedRecordHeaders`, `buildLibraryFastaFile`, `runMode`

**Fields that are `data`-only but currently pass through** (no workflow harm, but should be excluded for cleanliness):
`defaultBlockLabel`, `customBlockLabel`, `title`, `referenceFileHandle`

> Current skeleton `.args` in index.ts:72–98 uses a spread-minus-exclusions pattern. Tasks 3 must replace this with an explicit projection that also adds the conditional `limitInput` and `tagPattern` canonicalization.

**Conditional / canonicalization rules:**
- `limitInput` → include only when `data.runMode === 'dry'`; omit entirely when `runMode === 'full'`
- `tagPattern` → `data.tagPattern.trim()` before return

**Validation throws** (replace V1 `BlockArgsValid` guard):
- `data.datasetRef` undefined → throw `'Input dataset is required'`
- `data.chains` undefined/empty → throw `'Chain selection is required'`
- `data.runMode === 'dry' && (data.limitInput == null || data.limitInput <= 0)` → throw `'Read limit must be a positive integer for Preview mode'`
- `mode === 'libraryFile' && data.libraryFile === undefined` → throw `'Library file is required'`
- `mode === 'buildLibrary' && (data.libraryEntries?.length ?? 0) === 0` → throw `'Library entries are required for Build Library mode'`
- `mode !== 'libraryFile' && mode !== 'buildLibrary' && data.datasetRef !== undefined && data.librarySequence === undefined && data.vGenes === undefined` → throw `'Reference sequence or V/J genes are required'`

---

## Conclusions for Task 4 (`.prerunArgs`)

The `.prerunArgs` lambda should return exactly the fields `prerun.tpl.tengo` reads:

```ts
.prerunArgs((data) => ({
  referenceInputMode: data.referenceInputMode,   // prerun.tpl.tengo:11
  chains: data.chains,                           // prerun.tpl.tengo:20
  buildLibraryVGenes: data.buildLibraryVGenes,   // prerun.tpl.tengo:23
  buildLibraryJGenes: data.buildLibraryJGenes,   // prerun.tpl.tengo:24
}))
```

`prerun.tpl.tengo` is small (34 lines). It only activates when `referenceInputMode === 'buildLibrary'` and both gene strings are defined. The projection is similarly minimal.

**Lambda must be pure** (`(data) => …`, no `ctx`).

---

## Fields with uncertainty / candidates for cleanup

| Field | Issue |
|---|---|
| `title` (BlockArgs:43) | Never read by any workflow template. Possibly legacy. Verify with UI search before removing. |
| `referenceFileHandle` (BlockArgs:56) | Never read by any workflow template. Dead field. Verify with UI search; if unused, remove in a cleanup PR. |
| `defaultBlockLabel` / `customBlockLabel` | In `BlockArgs` but no workflow reads them. They route through `.subtitle()` in the model, not the workflow. Correct as `data`-only but should be removed from `BlockArgs` type if that type is meant to represent "workflow inputs only". |
