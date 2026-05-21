---
'@platforma-open/milaboratories.mixcr-amplicon-alignment.model': minor
'@platforma-open/milaboratories.mixcr-amplicon-alignment.ui': minor
'@platforma-open/milaboratories.mixcr-amplicon-alignment': minor
---

Migrate amplicon alignment to BlockModelV3 and add Preview / Full Run mode toggle. Existing V1 projects continue to work via the `DataModelBuilder.upgradeLegacy` path — `runMode` is inferred from the previous `limitInput`. New projects default to Full run; Preview reads a configurable subset for fast iteration.

Also includes a workflow CID-conflict fix in `export-report.tpl.tengo` (pure → ephemeral; `splitDataAndSpec: true`).
