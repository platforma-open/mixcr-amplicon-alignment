---
"@platforma-open/milaboratories.mixcr-amplicon-alignment.ui": patch
---

Reference FASTA headers with a description no longer break the reference library.

Gene names are derived from the FASTA header, and repseqio addresses each gene as the
fragment of a `file://<file>#<geneName>` URI — where spaces and most punctuation are
illegal. A header such as `>S1-F4_VH parental anti-CD98hc heavy variable domain (…)`
was passed through in full, so building the library failed with
`URISyntaxException: Illegal character in fragment` after the UI had already reported
the input as valid.

The header is now reduced to its first whitespace-delimited field with characters
outside `[A-Za-z0-9_.-]` removed, and a counter is appended when two headers reduce to
the same token, so distinct references cannot silently merge into one gene.
