# @platforma-open/milaboratories.mixcr-amplicon-alignment

## 1.11.1

### Patch Changes

- 739e998: Update MiXCR, RepSeq.IO to the versions with the rebuilt Docker images. The old images trust the compromised eMudhra intermediate CAs.

## 1.11.0

### Minor Changes

- 1f21b71: Run MiXCR as one exec per step, as in MiXCR Clonotyping. `mixcr analyze --dry-run-json` plans the run and the block runs each step it lists (`mixcr align`, `mixcr assemble`, `mixcr qc`, and `refineTagsAndSort` for UMI patterns), each with its own CPU and memory from one resources table, sized from the step's input. The memory and CPU overrides in Advanced Settings still apply to every step, and Advanced Settings → Per-step resources sets a memory floor per step; none of these re-runs a finished sample. The Log tab shows each step's log in run order. Samples analysed by the published block are recovered on update, not re-run, when the reference comes from FASTA or a library file. With a Build Library reference they re-run once: the library is now encoded with sorted keys, so equal entries give equal bytes. The per-sample QC filter export now runs the `memory-from-limits` MiXCR entrypoint, as the main export does, and is sized at 90 bytes of RAM per .clns byte instead of 30, so its grant rises above the 24 GiB floor from 0.18 GiB of .clns instead of 0.53 GiB. Every exec the block runs is named, prefixed "Amplicon: ", so jobs, error messages and run records say what is running; the name is part of an exec's identity, so updated projects re-run their exports once. The reference-library build is left unnamed and unchanged, so its library, an input of every MiXCR run, is reused. The cohort aggregation no longer depends on sample IDs, and the memory override no longer re-runs the QC report, so identical runs are reused across blocks and projects. Requires MiXCR 4.7.0-406.

### Patch Changes

- 847d95e: Size ptabler runs from their input bytes and aggregate the cohort clonotype table in shards, as in MiXCR Clonotyping. The cohort aggregation is split into up to 26 shards by clonotypeKey, each sized from the bytes it scans and keeps, so its peak memory no longer grows with cohort size. The per-sample export step and both Parquet imports are sized by the SDK from their input instead of a flat grant. QC counts are computed per sample, so the cohort QC run reads one row per sample instead of every clonotype table. Both exportClones runs (the main export and the per-sample QC filter export) are sized from the .clns size with a 24 GiB floor and no ceiling, instead of a flat grant; the memory override raises that floor.

## 1.10.7

### Patch Changes

- d2a2d6d: Release every package through npm trusted publishing (OIDC) so each package's trusted publisher is used before it expires.

## 1.10.6

### Patch Changes

- 887acc0: Bump mixcr to 4.7.0-403-develop. Brings the built-in gene library to RepSeq.IO v6.5 (new species and chains, corrected rabbit and macaque references) and keeps up to 15 V gene candidates per read mate in amplicon presets, so near-identical V families (rabbit IGKV) no longer lose the true gene before mates are merged.

## 1.10.5

### Patch Changes

- 68b01b0: QC report table no longer fails with "Invalid sorting column" when a saved sort names a column the table no longer has (e.g. the sample name column after switching the input dataset). The stale sort is dropped instead.

## 1.10.4

### Patch Changes

- 0cc3dde: Update SDK: PlAgDataTable no longer recreates its grid in an endless loop

## 1.10.3

### Patch Changes

- 6a7fc75: Read reference FASTA files picked from a remote storage

  A FASTA picked from a data library the desktop has not mounted (an S3 bucket, for
  instance) failed with "Storage <id> is not mounted locally". The prerun now
  imports and re-exports an `index://` handle, and the UI parses those bytes.
  Applies to both the FASTA File reference input and the Build Library upload.

  When the platform cannot read the picked file (missing from the storage, storage
  unknown to the server), the picker now shows the failure instead of waiting
  indefinitely. Picking the same unparseable file twice no longer leaves the
  picker on "Reading file from storage…".

## 1.10.2

### Patch Changes

- 2044115: Bump mixcr version to 4.7.0-365-develop
- de60685: Update block-tools and tengo-builder to the versions CI requires

## 1.10.1

### Patch Changes

- 487157f: Bump SDK dependencies: model 1.83.9, ui-vue 1.83.13, workflow-tengo 6.10.0,
  tengo-builder 4.0.26, package-builder 3.16.0, block-tools 2.15.1, test 1.83.16.
- 49ee373: A reference FASTA header with a description no longer breaks the reference library.

  repseqio reads each gene name as the fragment of a `file://<file>#<geneName>` URI, so
  spaces and most punctuation are illegal. The UI passed the whole header through as the
  gene name, reported the input as valid, and repseqio then failed with
  `URISyntaxException: Illegal character in fragment`.

  The gene name is now the first whitespace-delimited field of the header, with characters
  outside `[A-Za-z0-9_.-]` removed. Two headers that reduce to the same name get a counter
  suffix, so distinct references never merge into one gene.

## 1.10.0

### Minor Changes

- 4bec3d6: Migrate to the V3 block model and add the block kind.

  The model moves from `BlockModel.create("Heavy")` to `BlockModelV3`: `args` and
  `uiState` merge into one `BlockData`, `argsValid` becomes checks inside the args
  projection that say why the block cannot run, and `upgradeLegacy` carries
  existing projects across. `referenceInputMode` used to exist in both halves,
  kept in step by a UI watcher; it is now a single field.

  The new kind package declares the block's init-params contract, so a project
  template can seed a configured MiXCR Amplicon Alignment block. It carries the
  input dataset, the V/J reference in whichever form it was given, and the MiXCR
  settings — but not resource allocation, view state, or the local file handles
  whose parsed contents already travel. The MiXCR settings vocabulary
  (`ReferenceInputMode`, `CloneClusteringMode`, `LibraryEntryDefinition` and the
  rest) moved into the kind, which the model re-exports.

  The args a template-created block sends are unchanged, so upgrading a project
  does not re-run MiXCR.

  SDK bumped to model 1.83.0, ui-vue 1.83.3, workflow-tengo 6.8.3.
  `samples-and-data` moves to 1.18+ for the workflow tests, since its 1.11 model
  was built against an SDK that still exported the V1 `BlockModel`.

## 1.9.1

### Patch Changes

- bacc8e1: Bump `@platforma-sdk/block-tools` to 2.14.3.
- 31c428d: Analyze counts input size once when sizing its memory request, cutting a run with
  31.75 GiB of reads from 191 GiB to 127 GiB.

  The 64 GiB floor is already a total-memory value for the run, so adding a
  `4 x size("reads")` term on top of it counted the input twice. RAM is now
  `clamp(4 x size("reads"), 64 GiB, 256 GiB)`. The floor, the 256 GiB ceiling, and the
  `64GiB` static fallback all behave as before.

  The analyze template's `hash_override` UUID also changes, which forces a one-time
  recompute of results cached against the previous hash. That UUID was identical to the
  one in mixcr-clonotyping, letting the backend treat two different templates as
  interchangeable; the two are now distinct.

## 1.9.0

### Minor Changes

- 06d4a75: Support disjoint assembling features for germline imputation across a mid-region (FR3) gap.

  When 2×150 reads don't overlap for long-CDR3 clones, a short uncovered window is left in FR3 and those clones are dropped at assembly. The assembling feature can now be a disjoint, comma-separated list of pieces (e.g. `FR1Begin:FR3Begin(+40),FR3Begin(+46):FR4End`) that brackets the gap: each mate fully covers one piece so the clone survives, fully-covered regions are exported as-is, and the skipped FR3 window plus the full VDJRegion are germline-imputed from the assigned V/J germline on export.

  The "Assembling feature" dropdown gains a "Custom (advanced)" option that reveals a free-text field for entering an arbitrary MiXCR gene feature, including such a disjoint one.

## 1.8.33

### Patch Changes

- 8d33d3b: Migrate block onto the structurer (`block-tools structure`) and refresh the SDK toolchain: block-tools 2.12.8, model/ui-vue 1.80.8, workflow-tengo 6.8.1, tengo-builder 4.0.19. Tool-managed tsconfig/oxlint/oxfmt/turbo/block-index layout replaces the hand-maintained config.

## 1.8.32

### Patch Changes

- dda5add: Migrate the analyze exec's RAM sizing to the fluent `exec.formula` API (workflow-tengo 6.7.0): `.memFormula(f.clamp(...))` → `.resources({ onCPU: { cpu, ram } })`. Behavior-preserving — RAM stays `clamp(64 GiB + 4·size("reads"), 64 GiB, 256 GiB)` with the same fallback.
- Updated dependencies [dda5add]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.21.16

## 1.8.31

### Patch Changes

- de84c27: Fix imputeGermline having no effect when assemblingFeature is CDR3. parseAssemblingFeature returned an empty imputed-feature list for CDR3, so no germline columns or MiXCR imputed export args were ever produced. CDR3 assembly now imputes the surrounding features (FR1, CDR1, FR2, CDR2, FR3, FR4, VDJRegion) from germline.
- Updated dependencies [de84c27]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.21.15

## 1.8.30

### Patch Changes

- c11e84c: Size MiXCR analyze memory from the input reads' file size instead of a fixed 64 GiB. The 64 GiB baseline becomes a floor; memory then grows linearly with the R1+R2 FASTQ blob size (4 bytes of RAM per byte), clamped to 256 GiB. File size is read from blob metadata (getBlobSize) with no pre-exec. The explicit "Advanced Settings" memory override is unchanged; on backends that can't evaluate resource formulas the 64 GiB floor is the static fallback.
- Updated dependencies [c11e84c]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.21.14

## 1.8.29

### Patch Changes

- 481accd: Fix downstream Sequence Liabilities and Lead Selection errors with range assembling features by exporting the aminoacid assembling feature sequence.
- Updated dependencies [481accd]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.21.13

## 1.8.28

### Patch Changes

- 2bd5020: Fixed bug in QC table when using FR1:FR4 assembling feature. SDK Update
- Updated dependencies [2bd5020]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.21.12
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.19.5
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.19.5

## 1.8.27

### Patch Changes

- a44cc33: Add an option to disable low-quality read mapping
- Updated dependencies [a44cc33]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.21.11
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.19.4
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.19.4

## 1.8.26

### Patch Changes

- d26daa1: Make axis label visible by default
- Updated dependencies [d26daa1]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.21.10

## 1.8.25

### Patch Changes

- b3d0382: Fix `FileNotFoundException: referenceLibrary.json (Permission denied)` when running on the localfs backend. The reference-library workflow invoked `repseqio inferPoints` and `repseqio compile` with the same path for input and output (`referenceLibrary.json`). On localfs, input files are mounted read-only, so the tool could read them but the final write back failed. The output is now written to a separate file (`referenceLibrary.out.json`).
- Updated dependencies [b3d0382]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.21.9

## 1.8.24

### Patch Changes

- a9c8cec: Input dropdown now requires a `pl7.app/sampleId` axis on the dataset — multiplexed (pre-demux) datasets, which carry a `pl7.app/sampleGroupId` axis instead, no longer appear as valid inputs.

  When the dropdown would be empty, the settings panel now shows an inline hint:

  - multiplexed FASTQ detected → suggest adding a `FASTQ Demultiplexing` block;
  - no FASTQ at all → suggest adding/running a `Samples & Data` block.
- Updated dependencies [a9c8cec]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.19.3
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.19.3

## 1.8.23

### Patch Changes

- 2ac36c0: Bump mixr version to 4.7.0-347-develop (switch back to default GC)
- Updated dependencies [2ac36c0]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.21.8

## 1.8.22

### Patch Changes

- b67eb61: Upgrade MiXCR to 4.7.0-343-develop — packed NucleotideSequence storage for 4x memory reduction
- Updated dependencies [b67eb61]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.21.7

## 1.8.21

### Patch Changes

- a463f4f: Fix memory allocation for aggregation step and correct GB/GiB unit mismatch across all workflow templates
- Updated dependencies [a463f4f]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.21.6

## 1.8.20

### Patch Changes

- 4a61ea6: update limits
- Updated dependencies [4a61ea6]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.21.5

## 1.8.19

### Patch Changes

- b93d463: fix memory for export
- Updated dependencies [b93d463]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.21.4

## 1.8.18

### Patch Changes

- 637e770: fix memory for export
- Updated dependencies [637e770]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.21.3

## 1.8.17

### Patch Changes

- c1af0a6: Set default error correction to none/off
- Updated dependencies [c1af0a6]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.19.2
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.19.2

## 1.8.16

### Patch Changes

- 86a06b3: Update clone label to id
- Updated dependencies [86a06b3]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.21.2
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.19.1
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.19.1

## 1.8.15

### Patch Changes

- bbefce5: Upgrade MiXCR to 4.7.0-317-develop — increases JVM non-heap memory headroom to fix OOM on export
- Updated dependencies [bbefce5]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.21.1

## 1.8.14

### Patch Changes

- 00ded91: Support custom reference library
- Updated dependencies [00ded91]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.21.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.19.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.19.0

## 1.8.13

### Patch Changes

- fb02889: Removed all logic and dependencies related to \`cdr3Sequences\` from the \`mixcr-amplicon-alignment\` block.
- Updated dependencies [fb02889]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.18.1
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.18.2
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.20.1

## 1.8.12

### Patch Changes

- 92da66c: Format reference json file
- Updated dependencies [92da66c]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.18.1

## 1.8.11

### Patch Changes

- e2b65c7: Support custom reference library file
- Updated dependencies [e2b65c7]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.20.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.18.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.18.0

## 1.8.10

### Patch Changes

- 2149d28: Fix column naming for range assembling features (e.g. CDR1:CDR3, FR2:FR4) without imputation.

  When using a range assembling feature without "Impute non-covered part", the workflow would fail with
  "column nSeqVDJRegion does not exist in export" because VDJRegion is never exported for non-full-range features.

  Changes:

  - Use the assembling feature itself as clonotype key column when VDJRegion is unavailable
  - Fix column naming to match MiXCR output format (e.g. `CDR1_TO_FR4` instead of `{CDR1Begin:FR4End}`)
  - Add unit tests covering column naming for all assembling feature variants with/without imputation
- Updated dependencies [2149d28]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.19.9

## 1.8.9

### Patch Changes

- cd0f414: Support custom assembling feature and imputation in amplicon alignment
- Updated dependencies [cd0f414]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.19.8
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.17.1
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.17.1

## 1.8.8

### Patch Changes

- 0b08dfc: Support wildcards in reference sequence, allow to select sequences from references
- Updated dependencies [0b08dfc]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.17.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.17.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.19.7

## 1.8.7

### Patch Changes

- 8fb37ed: Increase memory limit for mixcr export step to avoid OOM
- Updated dependencies [8fb37ed]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.19.6

## 1.8.6

### Patch Changes

- 3881c3e: Upgrade MiXCR to 4.7.0-309-develop
- Updated dependencies [3881c3e]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.19.5

## 1.8.5

### Patch Changes

- 0f80c38: Add minimalQuality arg to mixcr tool
- Updated dependencies [0f80c38]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.19.4

## 1.8.4

### Patch Changes

- 8685e8d: Add new mutation columns
- Updated dependencies [8685e8d]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.19.3

## 1.8.3

### Patch Changes

- 0af1197: Allow to upload reference sequence from file
- Updated dependencies [0af1197]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.16.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.16.0

## 1.8.2

### Patch Changes

- 4aeac00: Link memory limits of downstream operations (XSV conversion, MiXCR export, PTabler) to user-specified perProcessMemGB override to prevent over-scheduling on local runs
- Updated dependencies [4aeac00]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.19.2

## 1.8.1

### Patch Changes

- f8abb41: Switch MiXCR software endpoint from `main` to `memory-from-limits` for analyze and export steps to respect block memory quota instead of using MaxRAMPercentage
- Updated dependencies [f8abb41]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.19.1

## 1.8.0

### Minor Changes

- b6a7c08: Add assembly quality threshold setting to advanced options, allowing users to control the base quality cutoff for clonotype seeding during assembly (MiXCR badQualityThreshold parameter)

### Patch Changes

- Updated dependencies [b6a7c08]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.19.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.15.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.15.0

## 1.7.1

### Patch Changes

- 5198666: Upgrade MiXCR to 4.7.0-300-develop, add MI_LICENSE_DEBUG env, use --use-local-temp, show loading spinner while sample list loads
- Updated dependencies [5198666]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.18.1
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.14.1
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.14.1

## 1.7.0

### Minor Changes

- 656f2fe: stop codon replacement and dep updates

### Patch Changes

- Updated dependencies [656f2fe]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.18.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.14.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.14.0

## 1.6.0

### Minor Changes

- 34824d1: mutations columns added, removed unused columns, dependency updates and migrate block code to latest layout

### Patch Changes

- Updated dependencies [34824d1]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.17.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.13.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.13.0

## 1.5.0

### Minor Changes

- 187f583: Fix repseqio fasta generation, dependencies updates

### Patch Changes

- Updated dependencies [187f583]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.16.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.12.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.12.0

## 1.4.2

### Patch Changes

- a08b796: multiple UMI bug fix
- Updated dependencies [a08b796]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.15.0

## 1.4.1

### Patch Changes

- 8c5c9ff: Support custom block title and running status
- Updated dependencies [8c5c9ff]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.11.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.11.0

## 1.4.0

### Minor Changes

- 392f0eb: Qc report table and dependencies updates

### Patch Changes

- Updated dependencies [392f0eb]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.14.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.10.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.10.0

## 1.3.11

### Patch Changes

- f4d0ddb: Fix issue after update
- Updated dependencies [f4d0ddb]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.13.2

## 1.3.10

### Patch Changes

- 507d5e2: dependencies updating including MiXCR
- Updated dependencies [507d5e2]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.9.1
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.9.1
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.13.1

## 1.3.9

### Patch Changes

- d05a139: Updated block metadata

## 1.3.8

### Patch Changes

- 0b637f1: Possibility to choose clonotype assembling feature - VDJRegion or CDR3
- Updated dependencies [0b637f1]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.13.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.9.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.9.0

## 1.3.7

### Patch Changes

- 75ca0ce: change isProductive column values to true and false, sdk update
- Updated dependencies [75ca0ce]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.12.0

## 1.3.6

### Patch Changes

- 3d3e04d: updating dependencies
- Updated dependencies [3d3e04d]
- 4f1e226: export of raw mixcr data added
- Updated dependencies [4f1e226]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.8.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.8.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.11.0

## 1.3.5

### Patch Changes

- fb7d933: Support parquet format (update SDK)
- Updated dependencies [fb7d933]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.10.3
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.7.4

## 1.3.4

### Patch Changes

- ce7e72c: technical release
- b52b77d: technical release
- a21b4cc: technical release
- c468231: technical release
- Updated dependencies [ce7e72c]
- Updated dependencies [b52b77d]
- Updated dependencies [a21b4cc]
- Updated dependencies [c468231]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.7.2
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.7.3
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.10.2

## 1.3.3

### Patch Changes

- 852d183: [sdk/ui] Broken error propagation: block errors are not showing anymore
- Updated dependencies [852d183]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.7.2

## 1.3.2

### Patch Changes

- 2209c82: [sdk/ui] Broken error propagation: block errors are not showing anymore
- Updated dependencies [2209c82]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.7.1
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.7.1
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.10.1

## 1.3.1

### Patch Changes

- 07e7fc7: Update frame shift behaviour, general refactoring
- Updated dependencies [07e7fc7]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.10.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.7.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.7.0

## 1.3.0

### Minor Changes

- db9f3fe: fix J end and updating dependencies

### Patch Changes

- Updated dependencies [db9f3fe]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.6.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.6.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.9.0

## 1.2.0

### Minor Changes

- 79a4e71: umi support and updating dependencies

### Patch Changes

- Updated dependencies [79a4e71]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.8.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.5.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.5.0

## 1.1.0

### Minor Changes

- 3b008c0: updating SDK

### Patch Changes

- Updated dependencies [3b008c0]
- Updated dependencies [3b008c0]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.7.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.4.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.4.0

## 1.0.7

### Patch Changes

- 2af4406: Removed unused software import
- Updated dependencies [2af4406]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.6.0

## 1.0.6

### Patch Changes

- af0cbb1: Support batch system
- Updated dependencies [af0cbb1]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.5.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.3.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.3.0

## 1.0.5

### Patch Changes

- d17799a: support multiple sequences in fasta format as reference
- Updated dependencies [d17799a]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.4.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.2.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.2.0

## 1.0.4

### Patch Changes

- b3bcb06: support lanes and index read
- Updated dependencies [b3bcb06]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.3.0

## 1.0.3

### Patch Changes

- 86528bc: add only productive option to mixcr export
- Updated dependencies [86528bc]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.2.0

## 1.0.2

### Patch Changes

- 2ac7c87: Wildcards in reference sequence and --limit-input option in MiXCR
- Updated dependencies [2ac7c87]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.1.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.1.0
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.1.0

## 1.0.1

### Patch Changes

- f04fd32: correct github wf
- Updated dependencies [f04fd32]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow@1.0.1
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.model@1.0.1
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.ui@1.0.1

## 1.0.0

Initial release.
