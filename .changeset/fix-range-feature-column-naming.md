---
"@platforma-open/milaboratories.mixcr-amplicon-alignment.workflow": patch
---

Fix column naming for range assembling features (e.g. CDR1:CDR3, FR2:FR4) without imputation.

When using a range assembling feature without "Impute non-covered part", the workflow would fail with
"column nSeqVDJRegion does not exist in export" because VDJRegion is never exported for non-full-range features.

Changes:
- Use the assembling feature itself as clonotype key column when VDJRegion is unavailable
- Fix column naming to match MiXCR output format (e.g. `CDR1_TO_FR4` instead of `{CDR1Begin:FR4End}`)
- Add unit tests covering column naming for all assembling feature variants with/without imputation
