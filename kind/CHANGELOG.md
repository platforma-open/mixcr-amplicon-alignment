# @platforma-open/milaboratories.mixcr-amplicon-alignment.kind

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
