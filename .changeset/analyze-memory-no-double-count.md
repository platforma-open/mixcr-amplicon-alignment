---
"@platforma-open/milaboratories.mixcr-amplicon-alignment.workflow": patch
---

Analyze memory request no longer double-counts input size on top of the memory floor. The formula added a `4 x size("reads")` data term on top of the 64 GiB floor, but that floor is already a total-memory value, so the input was counted twice: 31.75 GiB of reads asked for 191 GiB instead of 127 GiB. RAM is now `clamp(4 x size("reads"), 64 GiB, 256 GiB)` — the floor and the 256 GiB ceiling are unchanged, and the `64GiB` static fallback is unchanged.

Also bumps the `hash_override` UUID on the analyze template, which forces a one-time recompute of results cached against the previous template hash. As a side effect this de-collides the template from the identically-pinned one in mixcr-clonotyping, which the backend could previously treat as interchangeable.
