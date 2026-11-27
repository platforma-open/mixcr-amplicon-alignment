---
"@platforma-open/milaboratories.mixcr-amplicon-alignment": patch
---

Compute the block subtitle without opening the block. The subtitle (input dataset, chains, assembling feature) is now computed by the model from the block's settings, so a block that was never opened shows it too. Existing blocks keep their subtitle and show as stale once after the update because the arguments change shape.
