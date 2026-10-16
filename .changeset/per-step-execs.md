---
"@platforma-open/milaboratories.mixcr-amplicon-alignment": minor
"@platforma-open/milaboratories.mixcr-amplicon-alignment.workflow": minor
"@platforma-open/milaboratories.mixcr-amplicon-alignment.model": minor
"@platforma-open/milaboratories.mixcr-amplicon-alignment.ui": minor
---

Run MiXCR as one exec per step, as in MiXCR Clonotyping. `mixcr analyze --dry-run-json` plans the run and the block runs each step it lists (`mixcr align`, `mixcr assemble`, `mixcr qc`, and `refineTagsAndSort` for UMI patterns), each with its own CPU and memory from one resources table, sized from the step's input. The memory and CPU overrides in Advanced Settings still apply to every step, and Advanced Settings → Per-step resources sets a memory floor per step; none of these re-runs a finished sample. The Log tab shows each step's log in run order. Samples analysed by the published block are recovered on update, not re-run. The per-sample QC filter export is sized at 90 bytes of RAM per .clns byte instead of 30, so its grant rises above the 24 GiB floor from 0.18 GiB of .clns instead of 0.53 GiB. Every exec the block runs is named, prefixed "Amplicon: ", so jobs, error messages and run records say what is running; the name is part of an exec's identity, so updated projects re-run their exports and reference-library builds once. The cohort aggregation no longer depends on sample IDs, a Build Library reference is encoded with sorted keys, and the memory override no longer re-runs the QC report, so identical runs are reused across blocks and projects. Requires MiXCR 4.7.0-406.
