---
"@platforma-open/milaboratories.mixcr-amplicon-alignment.workflow": minor
"@platforma-open/milaboratories.mixcr-amplicon-alignment.model": minor
"@platforma-open/milaboratories.mixcr-amplicon-alignment.ui": minor
---

Migrate model to BlockModelV3 and add Preview / Full run toggle. Preview runs MiXCR on 100,000 reads per sample for quick settings validation; Full run uses the entire dataset. Existing projects are auto-upgraded (limitInput > 0 maps to Preview).
