---
'@platforma-open/milaboratories.mixcr-amplicon-alignment.workflow': patch
---

Size every ptabler run from input bytes instead of sample count and flat pins

The cohort aggregate requested `cpu(max(N, 32))` and memory scaled on sample count; the two
Xsv imports, the main export and the QC report table carried flat 16 to 32 GiB pins. All are
now left to the SDK default, `between(2 GiB + 6 x bytes, memFloor or 2 GiB, 256 GiB)`, which
covers every measured point. `perProcessMemGB` becomes a floor on the aggregate rather than
the base of a sample-count formula.

Requires `@platforma-sdk/workflow-tengo` 6.11.0 for `pt.workflow().memFloor()`.
