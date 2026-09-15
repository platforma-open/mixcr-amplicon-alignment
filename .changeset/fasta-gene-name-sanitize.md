---
"@platforma-open/milaboratories.mixcr-amplicon-alignment.ui": patch
---

A reference FASTA header with a description no longer breaks the reference library.

repseqio reads each gene name as the fragment of a `file://<file>#<geneName>` URI, so
spaces and most punctuation are illegal. The UI passed the whole header through as the
gene name, reported the input as valid, and repseqio then failed with
`URISyntaxException: Illegal character in fragment`.

The gene name is now the first whitespace-delimited field of the header, with characters
outside `[A-Za-z0-9_.-]` removed. Two headers that reduce to the same name get a counter
suffix, so distinct references never merge into one gene.
