---
'@platforma-open/milaboratories.mixcr-amplicon-alignment.workflow': patch
---

Fix intermittent MiXCR failures (`Can't find library for library + custom`) and `CIDConflictError` during body re-evaluation.

- Give `mixcr-analyze.tpl.tengo` a unique `hash_override` UUID. It was copy-pasted from `mixcr-clonotyping`, so the two templates were being deduplicated as one on the Platforma backend — silently serving the wrong bytecode.
- Route the reference library as a dedicated `extra.referenceLibrary` field instead of embedding it inside `extra.params`. Matches the mixcr-clonotyping pattern.
- Build params JSON resources with canonical (key-sorted) encoding so CIDs are stable across body re-evaluations. Tengo `json.encode` iterates Go map keys in random order, which made `stopCodonReplacements`, `aminoAcidSeqColumnPairs`, and schema maps produce different bytes each pass.