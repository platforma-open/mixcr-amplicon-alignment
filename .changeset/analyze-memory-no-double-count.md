---
"@platforma-open/milaboratories.mixcr-amplicon-alignment.workflow": patch
---

Analyze counts input size once when sizing its memory request, cutting a run with
31.75 GiB of reads from 191 GiB to 127 GiB.

The 64 GiB floor is already a total-memory value for the run, so adding a
`4 x size("reads")` term on top of it counted the input twice. RAM is now
`clamp(4 x size("reads"), 64 GiB, 256 GiB)`. The floor, the 256 GiB ceiling, and the
`64GiB` static fallback all behave as before.

The analyze template's `hash_override` UUID also changes, which forces a one-time
recompute of results cached against the previous hash. That UUID was identical to the
one in mixcr-clonotyping, letting the backend treat two different templates as
interchangeable; the two are now distinct.
