---
"@platforma-open/milaboratories.mixcr-amplicon-alignment.workflow": patch
---

Migrate the analyze exec's RAM sizing to the fluent `exec.formula` API (workflow-tengo 6.7.0): `.memFormula(f.clamp(...))` → `.resources({ onCPU: { cpu, ram } })`. Behavior-preserving — RAM stays `clamp(64 GiB + 4·size("reads"), 64 GiB, 256 GiB)` with the same fallback.
