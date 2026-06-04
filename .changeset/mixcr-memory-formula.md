---
"@platforma-open/milaboratories.mixcr-amplicon-alignment.workflow": patch
---

Size MiXCR memory from the input reads instead of a fixed 64 GiB. The 64 GiB baseline becomes a floor; the request grows with compressed FASTQ size and is clamped to 256 GiB. The explicit "Advanced Settings" memory override is unchanged, and on backends without `getBlobSize` the baseline is used as a static fallback.

Requires a `@platforma-sdk/workflow-tengo` release with the `exec.formula` / `memFormula` resource-formula API.
