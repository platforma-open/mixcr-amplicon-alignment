---
"@platforma-open/milaboratories.mixcr-amplicon-alignment": minor
"@platforma-open/milaboratories.mixcr-amplicon-alignment.workflow": minor
"@platforma-open/milaboratories.mixcr-amplicon-alignment.model": minor
"@platforma-open/milaboratories.mixcr-amplicon-alignment.ui": minor
---

Size bulk (`generic-amplicon`) `assemble` memory from align's clone estimate (`estimatedInitialClones`) and aligned read count instead of the .vdjca size. An assembling feature of exactly `CDR3` takes the CDR3 row; every other feature takes the row fitted on VDJRegion. UMI runs, a global memory override, and a step override that sets more than the memory floor keep the .vdjca sizing. A step memory floor alone replaces the floor of the clone-estimate sizing, and the per-step settings show that floor for the steps it sizes.

`align` memory floor 32 → 16 GiB, as in mixcr-clonotyping: align streams its input, and its profiled floors were 4 GiB or less.

The sample log keeps the streams of align and the steps before it, and nests the streams of the later steps under one entry.
