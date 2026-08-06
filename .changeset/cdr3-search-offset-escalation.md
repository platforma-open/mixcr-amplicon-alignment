---
"@platforma-open/milaboratories.mixcr-amplicon-alignment.ui": patch
---

A reference that begins mid-FR1 no longer loses its CDR3.

The CDR3 is located with a cysteine-anchored regex applied from a fixed offset of 80
residues, which exists to skip the conserved FR1 cysteine. A reference covering only the
amplified region rather than the full domain begins mid-FR1, which pulls its CDR3
cysteine ahead of that offset and hides it. Strict parsing then rejected the reference
outright; lenient parsing reported success and split V from J at two-thirds of the
sequence — a guess that for the synthetic-nanobody reference put the boundary at 202 nt
instead of 253, with nothing shown in the UI to say the boundary was guessed.

The offset is now the primary search rather than the only one: when it finds nothing,
the whole translated sequence is searched before giving up. Every nucleotide reference
that resolved before resolves to the identical boundary.
