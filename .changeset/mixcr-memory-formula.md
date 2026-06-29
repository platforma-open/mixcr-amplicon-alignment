---
"@platforma-open/milaboratories.mixcr-amplicon-alignment.workflow": patch
---

Size MiXCR analyze memory from the input reads' file size instead of a fixed 64 GiB. The 64 GiB baseline becomes a floor; memory then grows linearly with the R1+R2 FASTQ blob size (4 bytes of RAM per byte), clamped to 256 GiB. File size is read from blob metadata (getBlobSize) with no pre-exec. The explicit "Advanced Settings" memory override is unchanged; on backends that can't evaluate resource formulas the 64 GiB floor is the static fallback.
