---
"@platforma-open/milaboratories.mixcr-amplicon-alignment": patch
"@platforma-open/milaboratories.mixcr-amplicon-alignment.workflow": patch
---

Size ptabler runs from their input bytes and aggregate the cohort clonotype table in shards, as in MiXCR Clonotyping. The cohort aggregation is split into up to 26 shards by clonotypeKey, each sized from the bytes it scans and keeps, so its peak memory no longer grows with cohort size. The per-sample export step and both Parquet imports are sized by the SDK from their input instead of a flat grant. QC counts are computed per sample, so the cohort QC run reads one row per sample instead of every clonotype table.
