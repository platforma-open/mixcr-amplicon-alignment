---
"@platforma-open/milaboratories.mixcr-amplicon-alignment.workflow": patch
---

Size MiXCR analyze memory from the input reads' line count instead of a fixed 64 GiB. The 64 GiB baseline becomes a floor; memory then grows linearly with the R1+R2 FASTQ line count (32 bytes per line), clamped to 256 GiB. Keying on line count (not compressed byte size) makes the request compression-independent. The explicit "Advanced Settings" memory override is unchanged; on backends that can't evaluate resource formulas the 64 GiB floor is the static fallback.

Requires a `@platforma-sdk/workflow-tengo` release with the `exec.formula` / `memFormula` resource-formula API.
