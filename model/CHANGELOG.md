# @platforma-open/milaboratories.mixcr-amplicon-alignment.model

## 1.21.0

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

### Patch Changes

- Updated dependencies [4bec3d6]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.kind@1.1.0

## 1.20.0

### Minor Changes

- 06d4a75: Support disjoint assembling features for germline imputation across a mid-region (FR3) gap.

  When 2×150 reads don't overlap for long-CDR3 clones, a short uncovered window is left in FR3 and those clones are dropped at assembly. The assembling feature can now be a disjoint, comma-separated list of pieces (e.g. `FR1Begin:FR3Begin(+40),FR3Begin(+46):FR4End`) that brackets the gap: each mate fully covers one piece so the clone survives, fully-covered regions are exported as-is, and the skipped FR3 window plus the full VDJRegion are germline-imputed from the assigned V/J germline on export.

  The "Assembling feature" dropdown gains a "Custom (advanced)" option that reveals a free-text field for entering an arbitrary MiXCR gene feature, including such a disjoint one.

## 1.19.6

### Patch Changes

- 8d33d3b: Migrate block onto the structurer (`block-tools structure`) and refresh the SDK toolchain: block-tools 2.12.8, model/ui-vue 1.80.8, workflow-tengo 6.8.1, tengo-builder 4.0.19. Tool-managed tsconfig/oxlint/oxfmt/turbo/block-index layout replaces the hand-maintained config.

## 1.19.5

### Patch Changes

- 2bd5020: Fixed bug in QC table when using FR1:FR4 assembling feature. SDK Update

## 1.19.4

### Patch Changes

- a44cc33: Add an option to disable low-quality read mapping

## 1.19.3

### Patch Changes

- a9c8cec: Input dropdown now requires a `pl7.app/sampleId` axis on the dataset — multiplexed (pre-demux) datasets, which carry a `pl7.app/sampleGroupId` axis instead, no longer appear as valid inputs.

  When the dropdown would be empty, the settings panel now shows an inline hint:

  - multiplexed FASTQ detected → suggest adding a `FASTQ Demultiplexing` block;
  - no FASTQ at all → suggest adding/running a `Samples & Data` block.

## 1.19.2

### Patch Changes

- c1af0a6: Set default error correction to none/off

## 1.19.1

### Patch Changes

- 86a06b3: Update clone label to id

## 1.19.0

### Minor Changes

- 00ded91: Support custom reference library

## 1.18.1

### Patch Changes

- fb02889: Removed all logic and dependencies related to \`cdr3Sequences\` from the \`mixcr-amplicon-alignment\` block.

## 1.18.0

### Minor Changes

- e2b65c7: Support custom reference library file

## 1.17.1

### Patch Changes

- cd0f414: Support custom assembling feature and imputation in amplicon alignment

## 1.17.0

### Minor Changes

- 0b08dfc: Support wildcards in reference sequence, allow to select sequences from references

## 1.16.0

### Minor Changes

- 0af1197: Allow to upload reference sequence from file

## 1.15.0

### Minor Changes

- b6a7c08: Add assembly quality threshold setting to advanced options, allowing users to control the base quality cutoff for clonotype seeding during assembly (MiXCR badQualityThreshold parameter)

## 1.14.1

### Patch Changes

- 5198666: Upgrade MiXCR to 4.7.0-300-develop, add MI_LICENSE_DEBUG env, use --use-local-temp, show loading spinner while sample list loads

## 1.14.0

### Minor Changes

- 656f2fe: stop codon replacement and dep updates

## 1.13.0

### Minor Changes

- 34824d1: mutations columns added, removed unused columns, dependency updates and migrate block code to latest layout

## 1.12.0

### Minor Changes

- 187f583: Fix repseqio fasta generation, dependencies updates

## 1.11.0

### Minor Changes

- 8c5c9ff: Support custom block title and running status

## 1.10.0

### Minor Changes

- 392f0eb: Qc report table and dependencies updates

## 1.9.1

### Patch Changes

- 507d5e2: dependencies updating including MiXCR

## 1.9.0

### Minor Changes

- 0b637f1: Possibility to choose clonotype assembling feature - VDJRegion or CDR3

## 1.8.0

### Minor Changes

- 4f1e226: export of raw mixcr data added

### Patch Changes

- 3d3e04d: updating dependencies

## 1.7.2

### Patch Changes

- ce7e72c: technical release
- b52b77d: technical release
- a21b4cc: technical release
- c468231: technical release

## 1.7.1

### Patch Changes

- 2209c82: [sdk/ui] Broken error propagation: block errors are not showing anymore

## 1.7.0

### Minor Changes

- 07e7fc7: Update frame shift behaviour, general refactoring

## 1.6.0

### Minor Changes

- db9f3fe: fix J end and updating dependencies

## 1.5.0

### Minor Changes

- 79a4e71: umi support and updating dependencies

## 1.4.0

### Minor Changes

- 3b008c0: speed up MiXCR clustering by relaxing fuzzy matching criteria or turning of clustering itself
- 3b008c0: updating SDK

## 1.3.0

### Minor Changes

- af0cbb1: Support batch system

## 1.2.0

### Minor Changes

- d17799a: support multiple sequences in fasta format as reference

## 1.1.0

### Minor Changes

- 2ac7c87: Wildcards in reference sequence and --limit-input option in MiXCR

## 1.0.1

### Patch Changes

- f04fd32: correct github wf
