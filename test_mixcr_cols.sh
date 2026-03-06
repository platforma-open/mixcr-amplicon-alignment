#!/bin/bash
features=("FR1:FR4" "CDR1:FR4" "FR2:FR4" "CDR2:FR4" "FR3:FR4" "CDR3:FR4" "FR1:CDR3" "CDR1:CDR3" "FR2:CDR3" "CDR2:CDR3" "FR3:CDR3")

for f in "${features[@]}"; do
  parts=(${f//:/ })
  feature="{${parts[0]}Begin:${parts[1]}End}"
  
  # Run a fake export just to see the help or error string, or actually run mixcr with a dummy input
  # actually mixcr exportClones -isProductive $feature dummy.clns output.tsv will fail with "Input file not found" but might print headers if we create an empty file... 
  # Wait, an empty .clns file isn't valid.
done
