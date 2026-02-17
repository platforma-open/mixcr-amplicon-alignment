# @platforma-open/milaboratories.mixcr-amplicon-alignment.workflow

## 1.19.0

### Minor Changes

- b6a7c08: Add assembly quality threshold setting to advanced options, allowing users to control the base quality cutoff for clonotype seeding during assembly (MiXCR badQualityThreshold parameter)

## 1.18.1

### Patch Changes

- 5198666: Upgrade MiXCR to 4.7.0-300-develop, add MI_LICENSE_DEBUG env, use --use-local-temp, show loading spinner while sample list loads

## 1.18.0

### Minor Changes

- 656f2fe: stop codon replacement and dep updates

### Patch Changes

- Updated dependencies [656f2fe]
  - @platforma-open/milaboratories.mixcr-amplicon-alignment.software@1.1.0

## 1.17.0

### Minor Changes

- 34824d1: mutations columns added, removed unused columns, dependency updates and migrate block code to latest layout

## 1.16.0

### Minor Changes

- 187f583: Fix repseqio fasta generation, dependencies updates

## 1.15.0

### Minor Changes

- a08b796: multiple UMI bug fix

## 1.14.0

### Minor Changes

- 392f0eb: Qc report table and dependencies updates

## 1.13.2

### Patch Changes

- f4d0ddb: Fix issue after update

## 1.13.1

### Patch Changes

- 507d5e2: dependencies updating including MiXCR

## 1.13.0

### Minor Changes

- 0b637f1: Possibility to choose clonotype assembling feature - VDJRegion or CDR3

## 1.12.0

### Minor Changes

- 75ca0ce: change isProductive column values to true and false, sdk update

## 1.11.0

### Minor Changes

- 4f1e226: export of raw mixcr data added

### Patch Changes

- 3d3e04d: updating dependencies

## 1.10.3

### Patch Changes

- fb7d933: Support parquet format (update SDK)

## 1.10.2

### Patch Changes

- ce7e72c: technical release
- b52b77d: technical release
- a21b4cc: technical release
- c468231: technical release

## 1.10.1

### Patch Changes

- 2209c82: [sdk/ui] Broken error propagation: block errors are not showing anymore

## 1.10.0

### Minor Changes

- 07e7fc7: Update frame shift behaviour, general refactoring

## 1.9.0

### Minor Changes

- db9f3fe: fix J end and updating dependencies

## 1.8.0

### Minor Changes

- 79a4e71: umi support and updating dependencies

## 1.7.0

### Minor Changes

- 3b008c0: speed up MiXCR clustering by relaxing fuzzy matching criteria or turning of clustering itself
- 3b008c0: updating SDK

## 1.6.0

### Minor Changes

- 2af4406: Removed unused software import

## 1.5.0

### Minor Changes

- af0cbb1: Support batch system

## 1.4.0

### Minor Changes

- d17799a: support multiple sequences in fasta format as reference

## 1.3.0

### Minor Changes

- b3bcb06: support lanes and index read

## 1.2.0

### Minor Changes

- 86528bc: add only productive option to mixcr export

## 1.1.0

### Minor Changes

- 2ac7c87: Wildcards in reference sequence and --limit-input option in MiXCR

## 1.0.1

### Patch Changes

- f04fd32: correct github wf
