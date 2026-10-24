---
"@platforma-open/milaboratories.mixcr-amplicon-alignment.kind": minor
"@platforma-open/milaboratories.mixcr-amplicon-alignment.model": minor
"@platforma-open/milaboratories.mixcr-amplicon-alignment.workflow": minor
"@platforma-open/milaboratories.mixcr-amplicon-alignment.ui": minor
---

Add a "V alignment min score" advanced setting, passed to MiXCR as
`align.parameters.vParameters.parameters.absoluteMinScore`.

MiXCR scores the V and J parts of a read separately. When the assembling feature covers only a
short stretch of V, a correct alignment can score below the preset threshold and the read is
dropped. Lowering the score keeps those reads. Unset by default, and an unset value stays out of
the analysis params, so samples analysed before the field existed are not re-run.
