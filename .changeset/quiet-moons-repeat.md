---
'@platforma-open/milaboratories.mixcr-amplicon-alignment.workflow': patch
'@platforma-open/milaboratories.mixcr-amplicon-alignment.ui': patch
---

Upgrade the SDK catalog and take the canonical structure refresh

block-tools 2.15.1 to 2.16.0, tengo-builder 4.0.26 to 4.1.0, model 1.83.9 to 1.83.17,
ui-vue 1.83.13 to 1.83.21, test 1.83.16 to 1.83.24.

The refresh wires `pl-tengo imports` into the workflow check. Its unused-import detector
only counts an alias as used when followed by a dot, so a lib exporting a bare function and
called directly is reported unused, deleted, and then fails to compile. `calculate-export-specs`
now exports a map and `process.tpl.tengo` dereferences it, which is also how every other local
lib in this block is used. Tracked for a proper fix in
`docs/text/work/tickets/tengo-builder-unused-import-false-positive.md`.
