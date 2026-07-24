---
'@platforma-open/milaboratories.mixcr-amplicon-alignment.workflow': minor
'@platforma-open/milaboratories.mixcr-amplicon-alignment.ui': minor
'@platforma-open/milaboratories.mixcr-amplicon-alignment': minor
---

Support disjoint assembling features for germline imputation across a mid-region (FR3) gap.

When 2×150 reads don't overlap for long-CDR3 clones, a short uncovered window is left in FR3 and those clones are dropped at assembly. The assembling feature can now be a disjoint, comma-separated list of pieces (e.g. `FR1Begin:FR3Begin(+40),FR3Begin(+46):FR4End`) that brackets the gap: each mate fully covers one piece so the clone survives, fully-covered regions are exported as-is, and the skipped FR3 window plus the full VDJRegion are germline-imputed from the assigned V/J germline on export.

The "Assembling feature" dropdown gains a "Custom (advanced)" option that reveals a free-text field for entering an arbitrary MiXCR gene feature, including such a disjoint one.
