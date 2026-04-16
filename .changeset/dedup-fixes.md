---
'@platforma-open/milaboratories.mixcr-amplicon-alignment.workflow': minor
'@platforma-open/milaboratories.mixcr-amplicon-alignment': minor
---

Fix cross-project deduplication for aggregation and QC report

- Add `anonymize: true` to aggregation processColumn (sample IDs no longer break CID)
- Anonymize QC report inputs and deanonymize output TSV (structural render deduplicates, ephemeral deanonymization per project)
- Pass `perProcessMemGB` as metaInput to QC report render (excluded from CID)
- Move `xsv.importFile` for QC report to caller with proper column specs
- Add `hash_override` to mixcr-export, aggregate-by-clonotype-key, export-report, repseqio-library templates
