#!/bin/bash
echo -e ">read1\nATGCATGCATGCATGCATGCATGCATGCATGCATGCAT" > dummy.fasta
mixcr align dummy.fasta dummy.vdjca >/dev/null 2>&1
mixcr assemble dummy.vdjca dummy.clns >/dev/null 2>&1

features=("FR1:FR4" "CDR1:FR4" "FR2:FR4" "CDR2:FR4" "FR3:FR4" "CDR3:FR4" "FR1:CDR3" "CDR1:CDR3" "FR2:CDR3" "CDR2:CDR3" "FR3:CDR3")

for f in "${features[@]}"; do
  parts=(${f//:/ })
  feature="{${parts[0]}Begin:${parts[1]}End}"
  mixcr exportClones -isProductive "$feature" dummy.clns out_$f.tsv >/dev/null 2>&1
  head -n 1 out_$f.tsv | cut -f 1
done
