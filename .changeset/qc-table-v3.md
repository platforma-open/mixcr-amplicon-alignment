---
"@platforma-open/milaboratories.mixcr-amplicon-alignment": patch
"@platforma-open/milaboratories.mixcr-amplicon-alignment.model": patch
---

QC report table no longer fails with "Invalid sorting column" when a saved sort names a column the table no longer has (e.g. the sample name column after switching the input dataset). The stale sort is dropped instead.
