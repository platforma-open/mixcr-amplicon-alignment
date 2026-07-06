---
'@platforma-open/milaboratories.mixcr-amplicon-alignment.workflow': patch
---

Fix imputeGermline having no effect when assemblingFeature is CDR3. parseAssemblingFeature returned an empty imputed-feature list for CDR3, so no germline columns or MiXCR imputed export args were ever produced. CDR3 assembly now imputes the surrounding features (FR1, CDR1, FR2, CDR2, FR3, FR4, VDJRegion) from germline.