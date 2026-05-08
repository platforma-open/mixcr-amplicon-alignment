---
'@platforma-open/milaboratories.mixcr-amplicon-alignment.workflow': patch
---

Fix `FileNotFoundException: referenceLibrary.json (Permission denied)` when running on the localfs backend. The reference-library workflow invoked `repseqio inferPoints` and `repseqio compile` with the same path for input and output (`referenceLibrary.json`). On localfs, input files are mounted read-only, so the tool could read them but the final write back failed. The output is now written to a separate file (`referenceLibrary.out.json`).
