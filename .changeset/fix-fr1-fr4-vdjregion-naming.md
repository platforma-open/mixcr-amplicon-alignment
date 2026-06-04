---
"@platforma-open/milaboratories.mixcr-amplicon-alignment.workflow": patch
"@platforma-open/milaboratories.mixcr-amplicon-alignment.model": patch
"@platforma-open/milaboratories.mixcr-amplicon-alignment.ui": patch
"@platforma-open/milaboratories.mixcr-amplicon-alignment": patch
---

Fix crash when assembling feature is FR1:FR4 (e.g. amplicon runs with a custom FASTA library). FR1:FR4 spans the full VDJRegion, which MiXCR exports under the "VDJRegion" name, but the block expected "FR1_TO_FR4"-named columns (isProductiveFR1_TO_FR4, isOOFFR1_TO_FR4, ...). The productive/flag feature is now normalized to "VDJRegion" for FR1:FR4 so exported column names match MiXCR's output in both the clonotype table and the QC report.

Update SDK to 1.78.4 and fix the resulting build: declare @milaboratories/helpers as a direct model dependency (TS2742 portable-type error) and pin vue to 3.5.24 to avoid a duplicate Vue instance in the UI type-check.
