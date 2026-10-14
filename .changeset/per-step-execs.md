---
"@platforma-open/milaboratories.mixcr-amplicon-alignment": minor
"@platforma-open/milaboratories.mixcr-amplicon-alignment.workflow": minor
"@platforma-open/milaboratories.mixcr-amplicon-alignment.model": minor
"@platforma-open/milaboratories.mixcr-amplicon-alignment.ui": minor
---

Run MiXCR as one exec per step, as in MiXCR Clonotyping. `mixcr analyze --dry-run-json` plans the run and the block runs each step it lists (`mixcr align`, `mixcr assemble`, `mixcr qc`, and `refineTagsAndSort` for UMI patterns), each with its own CPU and memory from one resources table, sized from the step's input. The memory and CPU overrides in Advanced Settings still apply to every step, and Advanced Settings → Per-step resources sets a memory floor per step; none of these re-runs a finished sample. The Log tab shows each step's log in run order. Samples analysed by the published block are recovered on update, not re-run. Requires MiXCR 4.7.0-406.
