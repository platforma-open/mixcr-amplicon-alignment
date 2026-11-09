---
"@platforma-open/milaboratories.mixcr-amplicon-alignment.model": patch
"@platforma-open/milaboratories.mixcr-amplicon-alignment.ui": patch
---

Compute the block subtitle without opening the block

The subtitle (input dataset, chains, assembling feature) is now computed by the model from
the block's settings, so a block that was never opened shows it too. Opening the block no
longer changes its arguments: the dataset name is written only when the user picks the
input. The trace label of the exported columns is unchanged. Existing blocks keep their
subtitle and show as stale once after the update because the arguments change shape.
