# @platforma-open/milaboratories.mixcr-amplicon-alignment.kind

## 1.1.2

### Patch Changes

- 5b95396: Size bulk (`generic-amplicon`) `assemble` memory from align's clone estimate (`estimatedInitialClones`) and aligned read count instead of the .vdjca size. An assembling feature of exactly `CDR3` takes the CDR3 row; every other feature takes the row fitted on VDJRegion. UMI runs, a global memory override, and a step override that sets more than the memory floor keep the .vdjca sizing. A step memory floor alone replaces the floor of the clone-estimate sizing, and the per-step settings show that floor for the steps it sizes.

  `align` memory floor 32 → 16 GiB, as in mixcr-clonotyping: align streams its input, and its profiled floors were 4 GiB or less.

  The sample log keeps the streams of align and the steps before it, and nests the streams of the later steps under one entry.

  Update the SDK: workflow-tengo 6.22.2, model, ui-vue and test 1.88.16, block-tools 2.19.1.

## 1.1.1

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

## 1.1.0

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
