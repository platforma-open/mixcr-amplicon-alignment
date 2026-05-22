---
'@platforma-open/milaboratories.mixcr-amplicon-alignment.workflow': patch
'@platforma-open/milaboratories.mixcr-amplicon-alignment': patch
---

Make workflow params resources canonically encoded so cross-project deduplication of MiXCR analyze, MiXCR export, and per-clonotype aggregation runs works as intended. Tengo's stdlib `json.encode` does not sort map keys, so passing raw Tengo maps to `processColumn`'s `extra.params` (and to `smart.createJsonResource`) produces non-deterministic resource CIDs and silently defeats cross-project cache recovery. Introduce a block-local `canonical-resource.lib.tengo` helper that wraps `smart.createValueResource(RTYPE_JSON, canonical.encode(value))` and use it at each affected site. Move `referenceLibrary` out of the params map into its own input field on `mixcr-analyze` and `mixcr-export` since references cannot round-trip through JSON. Use sorted-key iteration when building codon-translation chains in `mixcr-export` and `export-report` so the emitted PTabler workflow JSON is byte-stable. Remove unused `times` imports.
