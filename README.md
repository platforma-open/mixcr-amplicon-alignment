# MiXCR Amplicon Alignment

Align amplicon sequencing reads against your own reference construct instead of a germline database. This Platforma block uses MiXCR to annotate synthetic antibody and TCR libraries — the kind used in phage and yeast display — where diversity is engineered into defined regions of a known scaffold, and reports per-sample clonotypes with full alignment QC.

Open-source analysis block for Platforma, the biologics discovery platform by MiLaboratories. For the full no-code workflow, see [platforma.bio](https://platforma.bio/).

## What it does

Natural repertoires are annotated by aligning reads to a public germline database such as IMGT. Synthetic libraries cannot be, because their framework is a fixed engineered scaffold and their diversity is deliberately introduced at specific positions. Aligning them to germline genes produces poor hit rates and mis-assigned regions.

The MiXCR Amplicon Alignment block takes the reference construct you supply, builds a MiXCR reference library from it, and aligns your reads against that. Region boundaries — FR1 through FR4, CDR1 through CDR3 — are resolved on your own scaffold, so randomized positions are read out precisely rather than approximated.

You can provide the reference four ways: upload a FASTA file, paste FASTA directly, upload a prebuilt MiXCR library file, or build a library entry region by region in the UI (optionally auto-filling anchor points from an uploaded VDJ FASTA). Reads are then assembled into clonotypes by a feature you choose — the full VDJRegion, CDR3 alone, or any range such as `CDR1:CDR3` or `FR2:FR4` — with the option to impute regions the amplicon does not cover from germline.

For display campaigns, the block can translate through stop codons: select Amber (TAG), Ochre (TAA), or Opal/Umber (TGA) and give the residue each should be read as, matching the suppressor strain used in your selection. UMI and barcode extraction is configured with a MiXCR tag pattern, so abundances are counted by unique molecule rather than by read where the library design allows it.

Results include a per-sample alignment summary showing exactly why reads failed, a QC report table of alignment and assembly metrics across all samples, per-sample MiXCR reports and logs, the generated reference library, and raw TSV export.

## Inputs & outputs

* **Input:** FASTA or FASTQ sequencing data (single or paired-end, optionally gzipped) plus a reference construct — as a FASTA file, pasted FASTA, a MiXCR library file, or a library built region by region in the block
* **Output:** a clonotype dataset with per-sample abundances and region sequences, consumable by any downstream Platforma block; a QC report table of per-sample alignment and assembly metrics; per-sample reports, logs, and alignment charts; the generated reference library; raw TSV export

## Specifications

| | |
|---|---|
| Block title in app | MiXCR Amplicon Alignment |
| Aligner | [MiXCR](https://mixcr.com/) — aligns to a user-supplied reference, not a germline database |
| Reference input | FASTA file, pasted FASTA, MiXCR library file, or built region by region in the UI |
| Chains | IG Heavy (default), IG Light, TCR-α, TCR-β, TCR-ɣ, TCR-δ |
| Assembling feature | VDJRegion (default), CDR3, ranges such as `FR1:FR4` / `CDR1:CDR3` / `FR3:FR4`, or a custom feature; non-covered regions can be imputed from germline |
| Error correction | Relaxed (recommended for synthetic libraries), MiXCR default, or off |
| UMI / barcodes | MiXCR tag pattern, for UMI-corrected abundances |
| Stop codon handling | Amber (TAG), Ochre (TAA), Opal/Umber (TGA) — each with a configurable replacement residue |
| Other settings | Assembly quality threshold, read limit for dry runs, per-sample memory and CPU |

## Use cases

* **Phage and yeast display libraries:** annotate selection-round sequencing against the exact construct used in the campaign.
* **Library QC:** use the alignment summary and QC report table to confirm that reads match the intended construct before drawing conclusions about diversity.
* **UMI-corrected abundances:** extract UMIs with a tag pattern so amplification bias does not inflate clonotype frequencies.
* **Nanobody and single-domain libraries:** align VHH constructs supplied as a single reference sequence.


## Downstream analysis

The clonotype dataset feeds the rest of the Platforma antibody discovery workflow:

* **[Sequence Browser](https://github.com/platforma-open/clonotype-browser)** — explore, tag, and annotate clonotypes
* **[Enrichment Analysis](https://github.com/platforma-open/clonotype-enrichment)** — track frequency changes across selection rounds
* **[Sequence Clustering](https://github.com/platforma-open/clonotype-clustering)** — group related variants into families
* **[Sequence Space](https://github.com/platforma-open/clonotype-space)** — map the library in 2D
* **[Sequence Liabilities](https://github.com/platforma-open/antibody-sequence-liabilities)** and **[Humanness Score](https://github.com/platforma-open/humanization-score)** — developability assessment
* **[Lead Selection](https://github.com/platforma-open/antibody-tcr-lead-selection)** — rank and pick candidates

## FAQ

### When should I use this block instead of MiXCR Clonotyping?

Use MiXCR Amplicon Alignment when your library is built on a known engineered scaffold and you have its reference sequence — synthetic libraries, display campaigns, mutagenesis panels. Use MiXCR Clonotyping when you are profiling a natural repertoire and need clonotypes discovered against germline genes.

### What reference sequence should I provide?

The exact variable region of your construct, in frame. Result quality depends almost entirely on this: an incorrect, out-of-frame, or partial reference produces low alignment rates and unreliable region assignment.

### Can I use it for TCR libraries?

Yes. Chain selection covers IG Heavy, IG Light, and all four TCR chains (α, β, ɣ, δ).

### How do I get UMI-corrected counts?

Supply a MiXCR tag pattern describing where the UMI sits in your reads — for example `^(UMI:N{12})(R1:*)\^(R2:*)` for a 12 bp UMI at the start of Read 1 in a paired-end run. Abundances are then counted per unique molecule. See the [MiXCR tag pattern reference](https://mixcr.com/mixcr/reference/ref-tag-pattern/).

### Why are stop codon settings there?

Display libraries are often propagated in suppressor strains that read a stop codon as an amino acid — amber suppression reading TAG as glutamine, for instance. Without this setting those clonotypes are discarded as non-productive. Selecting the codon and its replacement residue keeps them in the analysis.

### Which error correction mode should I pick?

Relaxed is recommended for most synthetic libraries: mutagenesis-derived diversity is high, and this mode handles it efficiently. Use MiXCR's default mode for lower-quality or long-read data. Turning correction off is fastest but can report erroneous clonotypes as real diversity.

### My alignment rate is low — what now?

Check the per-sample alignment summary; it breaks failures down by cause. "No gene hits" points at a reference that does not match the reads. Also confirm the chain selection, and that any tag pattern matches your actual read layout — an incorrect pattern shows up as reads failing on "no barcode".

### Do I need a MiXCR license?

Yes. MiXCR requires a license key, which is [free for academic scientists, PhD students, and non-profit R&D centres](https://mixcr.com/mixcr/getting-started/license/); commercial use requires a business licence. Keys are available at [platforma.bio/getlicense](https://platforma.bio/getlicense).

## References

> Bolotin, D. A., Poslavsky, S., Mitrophanov, I., Shugay, M., Mamedov, I. Z., Putintseva, E. V., & Chudakov, D. M. (2015). MiXCR: software for comprehensive adaptive immunity profiling. *Nature Methods* **12**(5), 380–381. [https://doi.org/10.1038/nmeth.3364](https://doi.org/10.1038/nmeth.3364)

> Bolotin, D. A., Poslavsky, S., Davydov, A. N., et al. (2017). Antigen receptor repertoire profiling from RNA-seq data. *Nature Biotechnology* **35**(10), 908–911. [https://doi.org/10.1038/nbt.3979](https://doi.org/10.1038/nbt.3979)

## Part of the Platforma ecosystem

This block is part of [Platforma](https://platforma.bio/) by [MiLaboratories](https://github.com/milaboratory), built on [MiXCR](https://mixcr.com/). Explore the other open-source blocks at [github.com/platforma-open](https://github.com/platforma-open), and see the step-by-step guide at [Annotating Bulk Synthetic Libraries](https://docs.platforma.bio/guides/antibody-discovery/amplicon-clonotyping/).
