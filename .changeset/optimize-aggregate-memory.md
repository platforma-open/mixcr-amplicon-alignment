---
'@platforma-open/milaboratories.mixcr-amplicon-alignment.workflow': patch
---

Optimize clonotype aggregation memory: replace maxBy (top_k_by) with pre-sort + first() to enable streaming-compatible group_by in Polars
