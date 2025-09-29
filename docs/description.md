# Overview

This block is a specialized tool for analyzing sequencing data from antibody/TCR libraries built on a **known reference backbone**. It is the ideal for analysis of synthetic libraries, such as those used in phage or yeast display campaigns, where diversity is introduced into specific regions (e.g., CDRs) of a standard antibody framework.

Unlike the `MiXCR Clonotyping` block, which discovers novel clonotypes by aligning to a germline gene database, this block aligns reads against a user-provided reference sequences. This allows for precise analysis of randomized regions and detailed quality control of the library.

MiXCR is developed by MiLaboratories Inc. For more information, please see the [MiXCR website](https://mixcr.com/) and cite the following publication if you use this block in your research:

> Bolotin, D., Poslavsky, S., Mitrophanov, I. et al. MiXCR: software for comprehensive adaptive immunity profiling. _Nat Methods_ **12**, 380–381 (2015) [https://doi.org/10.1038/nmeth.3364](https://doi.org/10.1038/nmeth.3364)
