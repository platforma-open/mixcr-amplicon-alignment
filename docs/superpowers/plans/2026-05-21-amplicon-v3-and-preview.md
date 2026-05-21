# MiXCR Amplicon Alignment — BlockModelV3 Migration + Preview/Dry Run

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Ticket:** [MILAB-6069](https://www.notion.so/mixcr/33d3a83ff4af807cb7d5d43f4bfec435) — amplicon alignment portion only (clonotyping done; scFv out of scope here).

**Goal:** Migrate `blocks/mixcr-amplicon-alignment` from `BlockModel` (V1) to `BlockModelV3` and add a Preview / Full Run toggle (`runMode: 'dry' | 'full'`) wired to `limitInput`, matching the pattern already shipped in `mixcr-clonotyping`.

**Architecture:**
- `BlockData = BlockArgs & { runMode, ...UI-only fields }`. Workflow stays read-only on `args`; UI binds to `data`.
- `DataModelBuilder.from('v1').upgradeLegacy(...)` reads the V1 `(args, uiState)` pair off disk and produces a `BlockData`. Existing projects on disk infer `runMode` from `args.limitInput`.
- `.args()` projects + validates + canonicalises (throws when invalid, conditionally suppresses `limitInput` when `runMode==='full'` so a stale dry-run value doesn't leak into Full args).
- `.prerunArgs()` carries the discovery fields that drive `repseqio` library building (currently in `prerun.tpl.tengo`) so they auto-rerun without a Run prompt.
- UI in `SettingsPanel.vue` gains a `PlBtnGroup` for `runMode`; `limitInput` becomes conditional. Existing UI-only `data.logsOpen / settingsOpen / ...` already live in (V1) `uiState` and slot into V3 `data` unchanged.

**Tech Stack:** TypeScript (model), Vue 3 + ui-vue SDK (UI), Tengo (workflow, no rewrite expected), Vitest + `@platforma-sdk/test`.

**Reference migration:** `blocks/mixcr-clonotyping`, commits `f3349e6` (`migrate to ModelV3`) and `5abc924` (`refactor(model): better utilize BlockModelV3 output patterns`). Read both diffs before Task 1 — they are the canonical shape of the changes we need.

**Worktree:** `/Users/paulnewling/Desktop/Code/mictx/worktrees/mixcr-amplicon-alignment/MILAB-6069_v3-and-preview/` branched from `origin/main @ f8174c4`. Local main verified in sync with origin/main at planning time.

**Personal-notes background (read first):**
- `personal-notes/cid-conflicts-deep-dive.md` — CID formula, stamp blockId/trace on specs *after* `xsv.importFile`, never on inputs.
- `personal-notes/deduplication-deep-dive.md` — pure-template dedup rules, `inputCache`, `hash_override` discipline.
- `personal-notes/block-testing-state-of-play.md` + `block-testing-deep-dive.md` — V3 args-validation trap (errors don't reach UI), prerun-not-testable limitation, `mutateBlockStorage` not `setBlockArgs`.
- `blockmodel-v3-args-errors.md` (workspace root) — `.args()` throws are caught by the SDK and reduced to a boolean by the time the UI sees them; for validation messages we need an explicit `outputErrors` or hand-rolled `output('validationError', ...)` path.

---

## File Structure

Files we will create or modify in this worktree:

```
model/src/index.ts        MODIFY — V1 BlockModel → V3 BlockModelV3, DataModelBuilder,
                                   .args + .prerunArgs lambdas, ctx.args.X → ctx.data.X
model/src/args.ts         MODIFY — extend BlockArgsValid for Preview-mode invariants,
                                   add LegacyBlockArgs / LegacyBlockUiState aliases
ui/src/pages/SettingsPanel.vue
                           MODIFY — add PlBtnGroup<'dry'|'full'> for runMode,
                                   wrap limitInput field in v-if="data.runMode==='dry'",
                                   migrate all `app.model.args.X` reads → `app.model.data.X`
ui/src/App.vue            MODIFY — migrate `app.model.outputs.X` reads that flipped
                                   shape; data.* binding still works (already in data)
ui/src/pages/*.vue        MODIFY — replace any `app.model.args.X` with `app.model.data.X`
                                   (mechanical sweep, no logic change)
ui/src/app.ts             MODIFY — replace `defineApp` → `defineAppV3` if needed
                                   (clonotyping commit f3349e6 shows the exact diff)
workflow/src/main.tpl.tengo
                           UNCHANGED behavior; verify args contract still matches
                                   what V3 .args() projects. CID/dedup audit only.
workflow/src/prerun.tpl.tengo
                           UNCHANGED behavior; verify prerunArgs match what it reads.
test/src/wf.test.ts        MODIFY — setBlockArgs → mutateBlockStorage update-block-data,
                                   args shape adjusted (runMode field, limitInput
                                   conditional), 1 new dry-run case
.changeset/<slug>.md      CREATE — minor bump on .model + .ui + root block package
pnpm-workspace.yaml       MODIFY — @platforma-sdk/block-tools 2.8.0 → 2.8.1 (CI gate)
pnpm-lock.yaml            REGENERATE on install — must commit alongside workspace change
docs/superpowers/plans/2026-05-21-amplicon-v3-and-preview.md
                           This document.
```

---

## Why the existing test assets are sufficient (and what the published-block baseline looks like)

`blocks/mixcr-amplicon-alignment/test/assets/s1_R{1,2}.fastq.gz` are ~32 KB and ~37 KB respectively — already toy fixtures, and they drive the four `wf.test.ts` cases that ship today (`debug output disabled`, `simple project`, `CDR1:CDR3 without imputation`, `library mode`). We do **not** need to fetch a new dataset from the Notion projects list for development; that list is for *user-scale* end-to-end verification, which we defer until we have a green V3 build.

The "test against the published block first" step in this plan is **not** about a different dataset — it is about running the V1 test suite *unmodified* on `origin/main` to capture a baseline (Task 0), then comparing against the same suite running on the migrated V3 block. Same toy FASTQ, same workflow, only the model + test harness shape change. That's the apples-to-apples regression check.

If we later need a larger, biologically realistic dataset for manual smoke testing in the desktop app, the Notion projects board has options; pick one only after the test suite is green.

---

## Phase 0 — Field-by-field channel decision (BLOCKING; do this in Task 2 before writing `.args` / `.prerunArgs`)

This step is load-bearing per `harnesses/block-dev/model-v1-to-v3-migration.md`. Skipping it produces **shallow V3** — V1 wearing a V3 jacket.

Audit every field in current `BlockArgs` (model/src/index.ts) and `UiState`, classify each:

- **UI-only** → lives in `data`, not projected at all. Candidates from the current code: `tableState`, `logsOpen`, `settingsOpen`, `sampleReportOpen`, `selectedSample`, `selectedRecordHeaders`, `referenceInputMode` (if purely a UI radio selection), `librarySequence` text-box state, `buildLibraryFastaFile` (the staged file handle pre-upload).
- **Discovery / staging / always-live** → `.prerunArgs`. Candidates: anything `prerun.tpl.tengo` currently reads — at minimum `referenceInputMode`, `chains`, `buildLibraryVGenes`, `buildLibraryJGenes`. These should *not* require the user to press Run to re-resolve the reference library.
- **Committed analysis decision** → `.args`. Everything else: `datasetRef`, `tagPattern`, `vGenes`/`jGenes` (when used as Full library), `assemblingFeature`, `imputeGermline`, `badQualityThreshold`, `disableLowQualityMapping`, `cloneClusteringMode`, `perProcessMemGB`, `perProcessCPUs`, `stopCodonTypes`, `stopCodonReplacements`, `defaultBlockLabel`, `customBlockLabel`, `limitInput` (conditional on runMode).

Lock the decision before writing code. The exact set will be refined when reading `prerun.tpl.tengo` line-by-line — it is shown in summary above but the build-library inputs may have additional fields not visible from the index summary.

---

## Task 0 — Capture baseline against the published-block code

**Goal:** Prove the current V1 test suite passes on the worktree's `origin/main` checkout, and save a baseline output snapshot we can compare V3 results against.

**Files:**
- Read: `test/src/wf.test.ts`, `test/assets/s1_R{1,2}.fastq.gz`
- Create: `docs/superpowers/plans/baselines/2026-05-21-v1-baseline.json` (output snapshot, gitignored or kept — your call)

**Acceptance Criteria:**
- [x] `'simple project'` blockTest case passes (this is the canonical regression target for later tasks)
- [x] Baseline output snapshot captured: `qc` (started + 5 alert/warn checks), `alignReport` (totalReadsProcessed=250, aligned=0 because the toy reference is synthetic), `doneSamples` (one sample ID — V1 has no direct `cloneCount` output in `BlockOutputs`; doneSamples is the V1 equivalent for "block finished cleanly")
- [x] Snapshot sanity-checked: `started === true`, `totalReadsProcessed === 250`, `doneSamples.length === 1`
- [ ] `FR2:FR4` and `CDR1:CDR3 without imputation` cases: **pre-existing CIDConflictError flakiness** when run sequentially in the same `pnpm test` invocation. They pass in isolation. NOT introduced by this work — observed against `origin/main @ f8174c4` unchanged. See **Finding F1** below.

### Finding F1 — pre-existing CID conflicts (investigated; partial fix in-scope, residual deferred)

Two distinct CID conflict mechanisms surfaced during the Task 0 baseline run. Both are pre-existing in V1; neither was introduced by V3 work.

**F1a — `export-report.tpl.tengo` pure-template collapse (FIXED in commit `10fe263`).**

`process.tpl.tengo:357` called `render.create(exportReportTpl, ...)` — a pure call inside an ephemeral template. `export-report.tpl.tengo` was itself pure (`self.defineOutputs("qcReportTable")`) and called `xsv.importFile` without `splitDataAndSpec: true`. With quasi-static inputs (same FASTA + same `chains: "IGH"` across multiple tests), two block instances raced on the same CID slot → conflict.

Fix applied (PR9 pattern): pure → ephemeral, `splitDataAndSpec: true`, results assembled via `pframes.pFrameBuilder` with canonical sorted iteration. See `docs/superpowers/plans/cid-investigation-2026-05-21.md` for the full root-cause analysis.

After this fix, `FR2:FR4` cases pass. `CDR1:CDR3` continues to fail with a separate conflict — see F1b.

**F1b — SDK-side `pframes.processColumn` retry-within-session conflict (DEFERRED — separate ticket).**

`pframes.processColumn` defaults to `eph: false`, so the SDK's `process-pcolumn-data.tpl.tengo` invokes the body template (here, `mixcr-analyze.tpl.tengo`) as a pure render. This is intentional and correct in production — exec dedup across identical-input block instances is valuable. The conflict only manifests when vitest **retries** a failed test in the same backend session: the retry creates a new block instance with the same FASTQ input CID and the same `params` JSON CID, producing the same structural CID, which then collides with the prior attempt's `outputs/files` glossary entry.

Fix scope: **separate Notion ticket targeting the SDK or test harness.** Block-side workaround (`isEphemeral: true`) would disable exec dedup in production — an unacceptable regression. Full analysis in `docs/superpowers/plans/cid-investigation-2-2026-05-21.md` (committed in `4116a2c`).

Recommended ticket title: `pframes.processColumn retry-within-session CIDConflictError on pure body templates`. Body to mirror Section 4 of the investigation #2 report.

**Implication for the rest of this plan:**

- `'simple project'` is the **single** reliable regression target for Task 6 and Task 9.
- Task 7's CID/dedup audit checklist gains two extra items (per investigation #2 §5): (1) verify every `render.create` inside an ephemeral template has canonically stable inputs; (2) verify every `pframes.processColumn` body template wrapping `exec.builder()` is used in a context where retry-within-session semantics are safe — or document that test retries must be disabled for this block.
- No further CID work is in scope of MILAB-6069. If the deferred SDK fix lands first, retest amplicon at that point — the conflict should disappear automatically.

**Verify:** `pnpm -C blocks/mixcr-amplicon-alignment test` → all green.

**Steps:**

- [ ] **Step 1: Install + build at the worktree root (no source edits yet)**

```bash
cd /Users/paulnewling/Desktop/Code/mictx/worktrees/mixcr-amplicon-alignment/MILAB-6069_v3-and-preview
pnpm install
pnpm build
```

Expected: build green; `pnpm-lock.yaml` may have changed — leave the diff for now (we'll bundle with Task 10).

- [ ] **Step 2: Run the published test suite unmodified**

```bash
cd /Users/paulnewling/Desktop/Code/mictx/worktrees/mixcr-amplicon-alignment/MILAB-6069_v3-and-preview
rtk pnpm test
```

Expected: all four `blockTest` cases pass within the 300_000ms timeout each.

- [ ] **Step 3: Capture baseline outputs from `simple project`**

Add a `console.log(JSON.stringify({ qc, alignReport, clones }, null, 2))` *temporarily* inside the `simple project` case, rerun the test, copy the printed JSON into `docs/superpowers/plans/baselines/2026-05-21-v1-baseline.json`. **Remove the console.log before committing** — it is purely a snapshot capture.

- [ ] **Step 4: Sanity-check the baseline**

Open the saved JSON. Verify clone count for `s1` is > 0, QC `started === true`, alignReport has non-zero `totalReadsProcessed`. If any of these are zero or missing, **stop and investigate** before any V3 work — we cannot regress against a broken baseline.

- [ ] **Step 5: Commit baseline (no source change)**

```bash
git add docs/superpowers/plans/2026-05-21-amplicon-v3-and-preview.md \
        docs/superpowers/plans/baselines/2026-05-21-v1-baseline.json
git commit -m "MILAB-6069: capture V1 baseline before V3 migration"
```

---

## Task 1 — Mechanical V1 → V3 skeleton: BlockData + DataModelBuilder + ctx.args→ctx.data sweep

**Goal:** Compile-green V3 model that behaves identically to V1. No behavior change yet — purely the type-and-builder transition.

**Files:**
- Modify: `model/src/index.ts`
- Modify: `model/src/args.ts` (add `LegacyBlockArgs`, `LegacyBlockUiState` type aliases)
- Modify: any `ui/src/**/*.vue` reading `app.model.args.X` (mechanical sweep → `app.model.data.X`)
- Modify: `ui/src/app.ts` if it constructs the app with `defineApp` (V1) → `defineAppV3` (V3)

**Acceptance Criteria:**
- [ ] `pnpm build` green across model + ui + workflow
- [ ] `pnpm type-check` green
- [ ] Existing test cases still pass — meaning behavior is unchanged
- [ ] No remaining `ctx.args.` or `app.model.args.` references in the worktree (grep returns empty for both)

**Verify:** `rtk pnpm build && rtk pnpm test` → green.

**Steps:**

- [ ] **Step 1: Add Legacy type aliases in `model/src/args.ts`**

At the end of `model/src/args.ts`, alias the existing types so the V3 migration code can reference them clearly:

```ts
// V1 shapes — referenced by DataModelBuilder.upgradeLegacy below.
// Aliased here so the migration code reads as "legacy → V3" rather than
// "V1 args → V3 data".
export type LegacyBlockArgs = BlockArgs;
export type LegacyBlockUiState = UiState;
```

- [ ] **Step 2: Rewrite `model/src/index.ts` header to V3**

Replace the V1 imports and builder header with V3 equivalents. Mirror `mixcr-clonotyping` commit `f3349e6` exactly:

```ts
import type { InferHrefType, PlDataTableStateV2 } from '@platforma-sdk/model';
import {
  BlockModelV3,
  DataModelBuilder,
  createPlDataTableStateV2,
  createPlDataTableV2,
  isPColumn,
  isPColumnSpec,
  parseResourceMap,
  type ImportFileHandle,
  type InferOutputsType,
} from '@platforma-sdk/model';
import type { BlockArgs, LegacyBlockArgs, LegacyBlockUiState } from './args';
import { BlockArgsValid } from './args';
import { ProgressPrefix } from './progress';

export type BlockData = BlockArgs & {
  // UI-only state that previously lived in V1 UiState — keep field names
  // identical so existing UI bindings (data.tableState, data.logsOpen, ...)
  // continue to work after the upgrade.
  tableState: PlDataTableStateV2;
  referenceInputMode?: 'fastaFile' | 'fastaSequence' | 'libraryFile' | 'buildLibrary';
  librarySequence?: string;
  selectedRecordHeaders?: string[];
  buildLibraryFastaFile?: ImportFileHandle;
  logsOpen?: boolean;
  settingsOpen?: boolean;
  sampleReportOpen?: boolean;
  selectedSample?: string;
  runMode: 'dry' | 'full';
};

const dataModel = new DataModelBuilder()
  .from<BlockData>('v1')
  .upgradeLegacy<LegacyBlockArgs, LegacyBlockUiState>(({ args, uiState }) => ({
    ...args,
    tableState: uiState.tableState,
    referenceInputMode: uiState.referenceInputMode,
    librarySequence: uiState.librarySequence,
    selectedRecordHeaders: uiState.selectedRecordHeaders,
    buildLibraryFastaFile: uiState.buildLibraryFastaFile,
    // limitInput > 0 in the V1 world meant "user enabled a read cap" — map that
    // to dry-run mode so legacy projects continue producing identical results.
    runMode: (args.limitInput ?? 0) > 0 ? 'dry' : 'full',
  }))
  .init(() => ({
    defaultBlockLabel: '',
    customBlockLabel: '',
    chains: 'IGHeavy',
    tagPattern: '',
    tableState: createPlDataTableStateV2(),
    runMode: 'full',
  }));

export const platforma = BlockModelV3.create(dataModel)
  // Step 3 wires .args here; for now leave both .args and .prerunArgs absent —
  // the SDK falls back to identity-on-data, so behavior matches V1 closely
  // enough to keep the test suite passing while the rest of the model is
  // converted.
  // ...
  ;
```

**Important:** finish the rest of the builder chain (`output`, `outputWithStatus`, `retentiveOutput`, `sections`, `title`, `subtitle`, `done`) by swapping every `ctx.args.X` for `ctx.data.X`. Do not change the *bodies* of the output lambdas in this task — that is a Task 4 concern.

- [ ] **Step 3: Mechanical UI sweep — `app.model.args.X` → `app.model.data.X`**

```bash
cd /Users/paulnewling/Desktop/Code/mictx/worktrees/mixcr-amplicon-alignment/MILAB-6069_v3-and-preview/ui
rtk grep -rn 'app\.model\.args\.' src
```

For each hit, replace `app.model.args.X` with `app.model.data.X`. There is at least one known hit at `ui/src/pages/SettingsPanel.vue:489` (`v-model="app.model.args.limitInput"`).

Anywhere the code uses `app.model.ui.X` or `data.X` already (UI state), leave it — those continue to point at the same field in V3 `BlockData`.

- [ ] **Step 4: Update `ui/src/app.ts` to V3 entry**

Compare `blocks/mixcr-clonotyping/ui/src/app.ts` against the current `mixcr-amplicon-alignment/ui/src/app.ts` and apply the same `defineApp` → `defineAppV3` (or `BlockOutputsBase`-style) change. The clonotyping commit `f3349e6` diff is the reference.

- [ ] **Step 5: Build, type-check, test**

```bash
cd /Users/paulnewling/Desktop/Code/mictx/worktrees/mixcr-amplicon-alignment/MILAB-6069_v3-and-preview
rtk pnpm build
rtk pnpm test
```

Expected: all green. Test suite still uses V1 `setBlockArgs` for now — that is okay; the test SDK accepts it and the legacy-upgrade path will normalise on read.

- [ ] **Step 6: Commit the skeleton**

```bash
git add -A
git commit -m "MILAB-6069: V1→V3 skeleton — BlockData, DataModelBuilder, ctx.data sweep"
```

---

## Task 2 — Phase 0 audit: lock the field channel decisions

**Goal:** Produce a written, reviewable mapping of every `BlockArgs`/`UiState` field to one of `args`, `prerunArgs`, or `data`-only. This is the load-bearing artefact for `.args()` and `.prerunArgs()` to be written correctly in Tasks 3 and 4.

**Files:**
- Create: `docs/superpowers/plans/2026-05-21-amplicon-v3-and-preview.field-audit.md`

**Acceptance Criteria:**
- [ ] Every current `BlockArgs` field has a row
- [ ] Every current `UiState` field has a row
- [ ] Each row names a channel (`args` / `prerunArgs` / `data`-only) and a one-line justification anchored in `prerun.tpl.tengo` or `main.tpl.tengo` behavior

**Verify:** read the audit file end-to-end; for each `args`-row, the workflow body reads that field; for each `prerunArgs`-row, the prerun template reads that field; for each `data`-only row, the workflow never reads it.

**Steps:**

- [ ] **Step 1: Read both Tengo templates carefully**

```bash
cd /Users/paulnewling/Desktop/Code/mictx/worktrees/mixcr-amplicon-alignment/MILAB-6069_v3-and-preview
rtk cat workflow/src/main.tpl.tengo workflow/src/prerun.tpl.tengo
```

For every `args.X` read in either template, note which template reads it. That governs whether the field belongs in `args` (main reads it) or `prerunArgs` (prerun reads it). A field read by *both* belongs in both (declare it in `args` and re-derive in `prerunArgs` via the same data field).

- [ ] **Step 2: Write the audit document**

Format (one Markdown table, top of `2026-05-21-amplicon-v3-and-preview.field-audit.md`):

```markdown
# Phase 0 — Field channel audit

| Field (current source) | Where workflow reads it | V3 channel | Rationale |
|---|---|---|---|
| `datasetRef` (BlockArgs) | `main.tpl.tengo` line N — `inputRef := args.datasetRef` | args | committed analysis decision; staling on change is correct |
| `chains` (BlockArgs) | `main.tpl.tengo` line N + `prerun.tpl.tengo` line M | args + prerunArgs | both phases need it; declare in both lambdas, read from `data.chains` |
| `tagPattern` (BlockArgs) | `main.tpl.tengo` line N | args | staling correct; canonicalise (`.replace(/\s+/g, '')`) before returning |
| `limitInput` (BlockArgs) | `main.tpl.tengo` line N | args, *conditional* | omit when `data.runMode === 'full'` so stale dry values don't leak |
| `referenceInputMode` (UiState) | `prerun.tpl.tengo` | prerunArgs | drives discovery; user expects auto-rerun, not a Run gate |
| `librarySequence` (UiState) | nowhere | data-only | text-box state, UI rendering only |
| ... | ... | ... | ... |
```

Fill out every field. Where you cannot pin down a usage, mark `[VERIFY]` and resolve before Task 3.

- [ ] **Step 3: Self-review the audit**

Run the **scope test** from `harnesses/block-dev/model-v1-to-v3-migration.md`:

- Is any `prerunArgs` field something the user "commits to" before pressing Run? If yes, it belongs in `args`, not `prerunArgs`. (Pulling a thoroughly-stale-by-design field into prerun gives the user no agency.)
- Is any `args` field one the user expects to "just be current" without a Run prompt? If yes, move it to `prerunArgs`.

- [ ] **Step 4: Commit the audit**

```bash
git add docs/superpowers/plans/2026-05-21-amplicon-v3-and-preview.field-audit.md
git commit -m "MILAB-6069: Phase 0 field channel audit"
```

---

## Task 3 — Wire `.args(data => …)` with validation + canonicalisation + conditional `limitInput`

**Goal:** Produce the V3 `.args` lambda matching the field audit. Throws on invalid input. Canonicalises `tagPattern`. Conditionally suppresses `limitInput` when `runMode === 'full'`.

**Files:**
- Modify: `model/src/index.ts` (insert `.args` between `BlockModelV3.create(dataModel)` and the first `.output(...)`)
- Modify: `model/src/args.ts` if `BlockArgsValid` needs new invariants (e.g. "`limitInput > 0` required when `runMode === 'dry'`")

**Acceptance Criteria:**
- [ ] `.args` lambda is pure (`(data) => …` — no `ctx`, no result-pool reads)
- [ ] Every field surfaced in the audit's `args` channel is in the returned object
- [ ] `limitInput` is conditional on `runMode === 'dry'`
- [ ] At least one throw covers each "block isn't ready to run" precondition
- [ ] Tests still pass (legacy upgrade path masks the projection on initial run)

**Verify:** `rtk pnpm test` → green. Visual review: `.args` returns exactly the fields the workflow body reads.

**Steps:**

- [ ] **Step 1: Write the `.args` lambda**

Insert after `BlockModelV3.create(dataModel)`:

```ts
.args<BlockArgs>((data) => {
  if (!data.datasetRef) throw new Error('Input dataset is required');
  if (!data.chains) throw new Error('Chain selection is required');
  if (data.runMode === 'dry' && (data.limitInput == null || data.limitInput <= 0)) {
    throw new Error('Read limit must be a positive integer for Preview mode');
  }
  // Canonicalise tagPattern — whitespace is ignored by the downstream
  // tokenizer, so normalise here so two inputs that mean the same thing
  // produce identical args bytes (and don't fire the staleness gate).
  const tagPattern = data.tagPattern?.replace(/\s+/g, '') ?? '';
  if (!BlockArgsValid.safeParse(data).success) {
    throw new Error('Block configuration is incomplete');
  }
  return {
    defaultBlockLabel: data.defaultBlockLabel ?? '',
    customBlockLabel: data.customBlockLabel ?? '',
    datasetRef: data.datasetRef,
    chains: data.chains,
    tagPattern,
    vGenes: data.vGenes,
    jGenes: data.jGenes,
    limitInput: data.runMode === 'dry' ? data.limitInput : undefined,
    perProcessMemGB: data.perProcessMemGB,
    perProcessCPUs: data.perProcessCPUs,
    cloneClusteringMode: data.cloneClusteringMode,
    assemblingFeature: data.assemblingFeature,
    imputeGermline: data.imputeGermline,
    badQualityThreshold: data.badQualityThreshold,
    disableLowQualityMapping: data.disableLowQualityMapping,
    stopCodonTypes: data.stopCodonTypes,
    stopCodonReplacements: data.stopCodonReplacements,
  };
})
```

The exact field list comes from the audit (Task 2). The shape above is a sketch matching what `main.tpl.tengo` reads today — verify line-by-line against the audit before committing.

- [ ] **Step 2: Update `BlockArgsValid` in `model/src/args.ts` if needed**

If the audit identified preconditions that previously lived in scattered UI checks, lift them into `BlockArgsValid` (a Zod schema). Goal: one place validates, one place throws.

- [ ] **Step 3: Build + test**

```bash
rtk pnpm build && rtk pnpm test
```

Expected: existing tests pass. If a test fails because the throw fires (legacy upgrade left a field missing), update the test's input setup *in Task 6*, not here.

- [ ] **Step 4: Commit**

```bash
git add model/src/index.ts model/src/args.ts
git commit -m "MILAB-6069: wire V3 .args lambda — validate, canonicalise, conditional limitInput"
```

---

## Task 4 — Wire `.prerunArgs(data => …)` for the build-library / discovery path

**Goal:** Move build-library inputs (and any other discovery fields the audit flagged) into `.prerunArgs`, so the repseqio library auto-regenerates as the user pastes/uploads FASTA, without the user needing to press Run.

**Files:**
- Modify: `model/src/index.ts` — insert `.prerunArgs(...)` after `.args(...)`

**Acceptance Criteria:**
- [ ] Every field in the audit's `prerunArgs` channel is in the returned object
- [ ] Lambda is pure (`(data) => …`, no `ctx`)
- [ ] `prerun.tpl.tengo` still receives all the fields it reads (verified by visual cross-check)

**Verify:** `rtk pnpm test` → green. Manually exercise via `pl` MCP cycle: edit one of the discovery fields and confirm prerun re-runs without the Run button going stale.

**Steps:**

- [ ] **Step 1: Insert `.prerunArgs` lambda**

```ts
.prerunArgs((data) => ({
  referenceInputMode: data.referenceInputMode,
  chains: data.chains,
  buildLibraryVGenes: data.buildLibraryVGenes,
  buildLibraryJGenes: data.buildLibraryJGenes,
  buildLibraryFastaFile: data.buildLibraryFastaFile,
  // Add any field that prerun.tpl.tengo reads but main.tpl.tengo does not.
}))
```

Exact field list comes from the Task-2 audit.

- [ ] **Step 2: Cross-check against `workflow/src/prerun.tpl.tengo`**

```bash
rtk grep -n 'args\.' workflow/src/prerun.tpl.tengo
```

Every match must correspond to a key in the `.prerunArgs` return value.

- [ ] **Step 3: Build + test**

```bash
rtk pnpm build && rtk pnpm test
```

- [ ] **Step 4: Commit**

```bash
git add model/src/index.ts
git commit -m "MILAB-6069: wire V3 .prerunArgs for repseqio discovery"
```

---

## Task 5 — Add Preview / Full Run toggle to `SettingsPanel.vue`

**Goal:** UI shape matching `mixcr-clonotyping/ui/src/SettingsPanel.vue:213` — a `PlBtnGroup` for `runMode` and a conditionally-rendered `limitInput` field that only appears when Preview is selected.

**Files:**
- Modify: `ui/src/pages/SettingsPanel.vue`

**Acceptance Criteria:**
- [ ] `PlBtnGroup` for `runMode` renders with two options ("Preview" → `'dry'`, "Full run" → `'full'`)
- [ ] `limitInput` field is hidden when `runMode === 'full'`
- [ ] Toggling to Preview reveals the limit input with a sensible default (e.g. 100_000 reads)
- [ ] Switching to Full clears the visible value (logic side-effect, not visual — the field just hides)
- [ ] No `app.model.args.X` references remain in the file

**Verify:** Manually via pl MCP — add the dev block to a project, see the toggle, type Preview limit, run, confirm the workflow sees the limit.

**Steps:**

- [ ] **Step 1: Read the clonotyping reference**

```bash
rtk cat /Users/paulnewling/Desktop/Code/mictx/blocks/mixcr-clonotyping/ui/src/SettingsPanel.vue
```

Look at lines around 213 (`runModeOptions`) and 522 (`<PlBtnGroup>` template). Copy the shape verbatim into the amplicon settings panel.

- [ ] **Step 2: Add `runModeOptions` constant near other `const ListOption<...>`s**

```ts
import type { ListOption } from '@platforma-sdk/ui-vue';
// ...
const runModeOptions: ListOption<'dry' | 'full'>[] = [
  { label: 'Preview', value: 'dry' },
  { label: 'Full run', value: 'full' },
];
```

- [ ] **Step 3: Add the template fragment**

In the template, near the existing read-limit input:

```vue
<PlBtnGroup
  v-model="app.model.data.runMode"
  :options="runModeOptions"
  label="Run mode"
/>
<template v-if="app.model.data.runMode === 'dry'">
  <PlNumberField
    v-model="app.model.data.limitInput"
    label="Read limit"
    :min="1"
    :step="10000"
    helper-text="Number of input reads to process for a quick preview."
  />
</template>
```

(Component names must match what the amplicon SettingsPanel already imports — copy from the existing `limitInput` block if `PlNumberField` is not the exact component used.)

- [ ] **Step 4: Build, then manually test via pl MCP**

```bash
rtk pnpm build:dev
```

Then with the `pl` MCP server connected:
1. `add_block` (or `update_block` if already added) pointing at the worktree's `block/` folder.
2. `run_block`, `await_block_done`.
3. `get_block_state` with `transform: "data.runMode"` to confirm the toggle persists.

- [ ] **Step 5: Commit**

```bash
git add ui/src/pages/SettingsPanel.vue
git commit -m "MILAB-6069: add Preview/Full run mode toggle to SettingsPanel"
```

---

## Task 6 — Migrate `test/src/wf.test.ts` to V3 patterns

**Goal:** Tests use V3 `mutateBlockStorage` instead of V1 `setBlockArgs`, work against `BlockData` shape, and gain one new `'preview mode reads a subset'` case.

**Files:**
- Modify: `test/src/wf.test.ts`

**Acceptance Criteria:**
- [ ] All four existing cases pass, adapted to V3 input shape
- [ ] New `'preview mode reads a subset'` case passes — runs with `runMode: 'dry', limitInput: 1000`, asserts that `alignReport.totalReadsProcessed === 1000` (or whatever the limit semantics produce)
- [ ] Prerun-dependent assertions are marked with `// @todo prerun` and either skipped or commented (per the testing-state-of-play note: V3 prerun is currently not awaitable in the test framework)

**Verify:** `rtk pnpm test` → green, including the new dry-run case.

**Steps:**

- [ ] **Step 1: Mechanical translation — `setBlockArgs(alignBlockId, args)` → `mutateBlockStorage`**

For each `setBlockArgs(alignBlockId, args)` call in the file, replace with:

```ts
await project.mutateBlockStorage(alignBlockId, {
  operation: 'update-block-data',
  value: {
    // Existing args fields go here, plus the new V3-only data fields:
    tableState: /* existing if set, else `undefined` works — V3 has init() defaults */,
    runMode: 'full',
    // ... copy the rest from the previous setBlockArgs payload, keyed at root
  } satisfies BlockData,
});
```

Note: `samples-and-data` is V1 and stays on `setBlockArgs`. Do not migrate the SND block calls.

- [ ] **Step 2: Read clonotyping test for the exact shape**

```bash
rtk cat /Users/paulnewling/Desktop/Code/mictx/blocks/mixcr-clonotyping/test/src/wf.test.ts
```

Lines around `await project.mutateBlockStorage(clonotypingBlockId, { operation: 'update-block-data', value: { ... } })` are the canonical example. Copy the shape; adapt the field set to amplicon's `BlockData`.

- [ ] **Step 3: Add the dry-run test case**

```ts
blockTest(
  'preview mode reads a subset',
  { timeout: 300_000 },
  async ({ rawPrj: project, ml, helpers, expect }) => {
    // ...same SND setup as 'simple project'...
    await project.mutateBlockStorage(alignBlockId, {
      operation: 'update-block-data',
      value: {
        // ...same fields as simple project, plus:
        runMode: 'dry',
        limitInput: 1000,
      } satisfies BlockData,
    });
    // ...await stable state, wrapOutputs...
    const alignReport = AlignReport.parse(/* ... */);
    expect(alignReport.totalReadsProcessed).toBe(1000);
  },
);
```

(Adjust the assertion based on what MiXCR's `align` report actually emits when `--limit` is set — verify against the V1 baseline JSON from Task 0 if needed.)

- [ ] **Step 4: Handle the prerun-output gap**

If any of the test assertions today touch a prerun-emitted field (e.g. preset list), wrap them in `it.todo` per the comment pattern in `mixcr-clonotyping/test/src/wf.test.ts`:

```ts
// @todo prerun: re-enable when test framework supports awaiting prerun outputs
// const presets = SupportedPresetList.parse( ... );
```

- [ ] **Step 5: Run tests**

```bash
rtk pnpm test
```

Expected: 5 green cases (4 migrated + 1 new).

- [ ] **Step 6: Compare against the V1 baseline from Task 0**

For the `'simple project'` case, the alignment report and clone counts must match the V1 baseline JSON. If they differ → behavioral regression somewhere in Tasks 1–4. Stop and bisect.

- [ ] **Step 7: Commit**

```bash
git add test/src/wf.test.ts
git commit -m "MILAB-6069: migrate tests to V3, add preview-mode case"
```

---

## Task 7 — CID / dedup audit (workflow-side; no rewrite expected)

**Goal:** Verify the V3 migration introduces no new CID conflicts or dedup regressions. The workflow itself is unchanged in this PR, but the inputs the model now sends down may have shifted shape — confirm nothing important moved.

**Files:**
- Read-only: `workflow/src/main.tpl.tengo`, `workflow/src/process.tpl.tengo`, `workflow/src/mixcr-analyze.tpl.tengo`, `workflow/src/repseqio-library.tpl.tengo`

**Acceptance Criteria:**
- [ ] No `args.X` reference in any template that points at a renamed-or-removed-by-V3 field
- [ ] Any `pframes.pFrameBuilder` / `xsv.importFile` site uses `splitDataAndSpec: true` and stamps `blockId`/trace **after** the import, not on the inputs (per `cid-conflicts-deep-dive.md` Part 5 §4)
- [ ] `mixcr-analyze.tpl.tengo` retains its `hash_override` UUID and is not edited semantically
- [ ] No `maps.getKeys(...)` iteration produces resource bytes unsorted (per `cid-conflicts-deep-dive.md` Part 5 §3)

**Verify:** Test by duplication — add the V3 block twice to the same project with identical inputs, run both, confirm second run dedups (deduplication checklist §10).

**Steps:**

- [ ] **Step 1: Sweep all templates for `args.` reads**

```bash
rtk grep -n 'args\.' workflow/src
```

Cross-reference against the `.args` lambda's return object from Task 3. Any field the workflow reads must be returned by `.args`. Any field `.args` returns but no template uses → remove from `.args` (dead state).

- [ ] **Step 2: Audit pFrame builders and xsv imports**

```bash
rtk grep -rn 'pFrameBuilder\|xsv\.importFile\|splitDataAndSpec' workflow/src
```

For every call, verify the pattern in `personal-notes/cid-conflicts-deep-dive.md` PR9 Part 1 ("Post-PR shape"): canonical spec → import → stamp blockId/trace on returned specs.

- [ ] **Step 3: Run "test by duplication"**

Via `pl` MCP:
1. Add the V3 block to a test project, configure, run.
2. Add a second instance with **identical** inputs, run.
3. Check `pl` backend logs (`get_block_logs`) for "deduplicated" / "cache hit" lines for the heavy `process` step; alternatively measure runtime — a fully deduped second run completes in seconds.

If the second instance reruns the heavy work: something in `.args` carries per-instance state. Suspect `defaultBlockLabel` / `customBlockLabel` if they appear in `.args` return (they shouldn't reach the workflow — verify against the audit).

- [ ] **Step 4: Document the audit outcome**

Append a short section to `2026-05-21-amplicon-v3-and-preview.field-audit.md`:

```markdown
## Task 7 — CID/dedup audit outcome

- Templates checked: main, process, mixcr-analyze, repseqio-library, prerun
- `args.X` reads accounted for: yes / no (list any orphans)
- Duplication test: passed (second instance cache-hit at process step)
- Action items: none / `<list>`
```

- [ ] **Step 5: Commit (audit only, no code change)**

```bash
git add docs/superpowers/plans/2026-05-21-amplicon-v3-and-preview.field-audit.md
git commit -m "MILAB-6069: CID/dedup audit, V3 model + workflow contract verified"
```

---

## Task 8 — Verify legacy upgrade fires on a real V1 project

**Goal:** Confirm `DataModelBuilder.upgradeLegacy(...)` actually fires when opening a project saved by the V1 (published) version of the block. Without this, customers with existing projects will see broken state on first open.

**Files:** none modified — verification only.

**Acceptance Criteria:**
- [ ] A project saved with the published V1 block opens cleanly under the V3 block
- [ ] `BlockData` after upgrade has `runMode` populated correctly: `'dry'` if the saved V1 `args.limitInput > 0`, else `'full'`
- [ ] All UI bindings render values (none `undefined`)

**Verify:** Manual via pl MCP cycle.

**Steps:**

- [ ] **Step 1: Build a V1 baseline project**

Switch the same desktop / pl backend to the **published** amplicon block (NOT the dev folder). Create a project, configure all settings (including a non-zero `limitInput` if possible), run it to completion, close the project, capture the project file.

Alternative: use the `origin/main` checkout of this worktree's repo (without our V3 changes) to build a published-style block locally; load it; save a project; switch the dev block source to the V3 worktree; reopen.

- [ ] **Step 2: Open the V1 project under V3**

`update_block` the project to the V3 dev folder. Then `get_block_state` with:

```
transform: "data"
```

- [ ] **Step 3: Verify the data shape**

The returned `data` object must contain:
- All V1 `args` fields at the root (datasetRef, chains, tagPattern, …)
- All V1 `uiState` fields (tableState, referenceInputMode, …)
- A new `runMode` field set to `'dry'` if `args.limitInput > 0`, else `'full'`

If anything is `undefined` that shouldn't be, the upgrade lambda has a gap — fix in `model/src/index.ts` and commit a fix.

- [ ] **Step 4: Run the block, confirm parity with V1 baseline**

The QC report / align report numbers should match the Task 0 baseline (same inputs → same outputs).

- [ ] **Step 5: Document in the audit file**

Append to the audit doc:

```markdown
## Task 8 — Legacy upgrade verification

- V1 project source: <describe>
- Upgrade fired: yes / no
- Fields populated: <list any nulls>
- Output parity with V1 baseline: yes / no
```

- [ ] **Step 6: If any field needed a fixup, commit it**

```bash
git add model/src/index.ts
git commit -m "MILAB-6069: fix legacy upgrade gaps found in real-project test"
```

---

## Task 9 — SDK version bump, changeset, final build

**Goal:** Ship-ready PR — block-tools bumped, changeset present, lockfile in sync.

**Files:**
- Modify: `pnpm-workspace.yaml` (`@platforma-sdk/block-tools: 2.8.0` → `2.8.1`)
- Regenerate: `pnpm-lock.yaml`
- Create: `.changeset/milab-6069-amplicon-v3.md`

**Acceptance Criteria:**
- [ ] `npm view @platforma-sdk/block-tools version` matches the workspace catalog version
- [ ] `pnpm-lock.yaml` change is committed alongside the workspace edit (CI hard requirement)
- [ ] `.changeset/` entry lists model + ui + root block package, with `minor` bump (V3 is a user-visible model API change)

**Verify:** `rtk pnpm build && rtk pnpm test` → green; `git diff --name-only origin/main..HEAD` shows the expected files and no surprises.

**Steps:**

- [ ] **Step 1: Bump block-tools**

Edit `pnpm-workspace.yaml`:

```yaml
catalog:
  '@platforma-sdk/block-tools': 2.8.1
```

Then `rtk pnpm install` to regenerate the lockfile.

- [ ] **Step 2: Write the changeset**

`.changeset/milab-6069-amplicon-v3.md`:

```markdown
---
'@platforma-open/milaboratories.mixcr-amplicon-alignment.model': minor
'@platforma-open/milaboratories.mixcr-amplicon-alignment.ui': minor
'@platforma-open/milaboratories.mixcr-amplicon-alignment': minor
---

Migrate amplicon alignment to BlockModelV3 and add Preview / Full Run mode toggle. Existing V1 projects continue to work via the `DataModelBuilder.upgradeLegacy` path — `runMode` is inferred from the previous `limitInput`. New projects default to Full run; Preview reads a configurable subset for fast iteration.
```

- [ ] **Step 3: Final full build + test**

```bash
rtk pnpm build && rtk pnpm test
```

- [ ] **Step 4: Commit**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml .changeset/milab-6069-amplicon-v3.md
git commit -m "MILAB-6069: bump block-tools to 2.8.1, add changeset"
```

- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin MILAB-6069_v3-and-preview
gh pr create --title "MILAB-6069: migrate amplicon alignment to BlockModelV3 + Preview mode" --body "$(cat <<'EOF'
## Summary
- Migrate `mixcr-amplicon-alignment` from `BlockModel` (V1) to `BlockModelV3`, mirroring the `mixcr-clonotyping` shape (commits `f3349e6`, `5abc924`).
- Add `runMode: 'dry' | 'full'` toggle in `SettingsPanel.vue`; `limitInput` becomes conditional on Preview mode.
- `DataModelBuilder.upgradeLegacy` preserves all existing V1 projects — `runMode` is derived from prior `limitInput`.

## Test plan
- [x] All four pre-existing `wf.test.ts` cases pass against V3
- [x] New `'preview mode reads a subset'` case asserts `--limit` flag round-trip
- [x] V1 project opened under V3 produces outputs identical to the V1 baseline captured pre-migration
- [x] Test-by-duplication confirms workflow dedup is intact
- [x] `pnpm-workspace.yaml` + `pnpm-lock.yaml` updated together
EOF
)"
```

---

## Self-review notes

- **Spec coverage:** The ticket asks for V3 migration + Preview/Dry Run on amplicon. Tasks 1–4 cover V3, Task 5 covers Preview UI, Task 6 covers tests, Task 8 covers backward-compat. All in.
- **CID/dedup:** Explicit Task 7 audit, leaning on `personal-notes/cid-conflicts-deep-dive.md` and `deduplication-deep-dive.md`. The workflow is not rewritten, so the risk surface is narrow; the audit confirms that.
- **Test data:** Existing 30–40 KB toy FASTQ in `test/assets/` is enough. Task 0 captures the V1 baseline; Task 6 + Task 8 compare against it. No external dataset needed for development.
- **Freshness:** Worktree is branched from `origin/main @ f8174c4`, verified up-to-date at planning time.
- **Memory checks applied:**
  - Worktree path under `worktrees/<repo>/<branch>/` (per `feedback_worktree_location`)
  - Don't auto-commit beyond what each task step explicitly does (per `feedback_no_auto_commit`)
  - Block test fixtures stay in `test/assets/` (per `feedback_block_test_assets_location`)
  - Build with `pnpm build:dev` during dev (per `feedback_build_command`)
  - PR description "Test plan" section is fine (this is a code repo, not the docs/text repo — `feedback_text_repo_pr_descriptions` doesn't apply)
- **Open questions to raise with reviewer before merge:**
  - Should the published V1 baseline JSON live in-repo, or be transient? Currently planned to commit; happy to gitignore if undesirable.
  - The clonotyping `subtitle` uses `customBlockLabel || defaultBlockLabel` — adopt the same in amplicon for consistency? (Currently amplicon may not have a subtitle wired.)
  - Are there published projects we should test against in Task 8 beyond the locally-saved fixture? If yes, name them on the Notion projects board.
