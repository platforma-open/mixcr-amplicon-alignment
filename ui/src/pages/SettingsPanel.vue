<script setup lang="ts">
import type { PlRef } from '@platforma-sdk/model';
import {
  PlAccordionSection,
  PlDropdown,
  PlDropdownMulti,
  PlDropdownRef,
  PlNumberField,
  PlSectionSeparator,
  PlTextArea,
  PlTextField,
  type ListOption,
} from '@platforma-sdk/ui-vue';
import { computed, ref, watch } from 'vue';
import { useApp } from '../app';
import { parseFasta } from '../utils/parseFasta';

const app = useApp();

function parseNumber(v: string): number {
  const parsed = Number(v);
  if (!Number.isFinite(parsed)) {
    throw Error('Not a number');
  }
  return parsed;
}

type AssemblingFeature = 'VDJRegion' | 'CDR3';
type StopCodonType = 'amber' | 'ochre' | 'opal';

// Validation state management
const fastaError = ref<string | undefined>();

function setInput(inputRef: PlRef | undefined) {
  app.model.args.datasetRef = inputRef;
  if (inputRef)
    app.model.args.title = app.model.outputs.inputOptions?.find(
      (o) => o.ref.blockId === inputRef.blockId && o.ref.name === inputRef.name,
    )?.label;
  else app.model.args.title = undefined;
}

// Watch for sequence changes and validate
watch(
  () => app.model.ui.librarySequence,
  (newSequence) => {
    if ((newSequence || '').trim()) {
      const result = parseFasta(newSequence || '');

      // If validation is successful, save the extracted sequences to args
      if (result.isValid) {
        fastaError.value = undefined;
        app.model.args.vGenes = result.vGenes;
        app.model.args.jGenes = result.jGenes;
        app.model.args.cdr3Sequences = result.cdr3Sequences;
      } else {
        // show error and clear sequences if validation fails
        fastaError.value = result.error;
        app.model.args.vGenes = undefined;
        app.model.args.jGenes = undefined;
        app.model.args.cdr3Sequences = undefined;
      }
    } else {
      fastaError.value = undefined;
      app.model.args.vGenes = undefined;
      app.model.args.jGenes = undefined;
      app.model.args.cdr3Sequences = undefined;
    }
  },
  { immediate: true },
);

const chainOptions = [
  { value: 'IGHeavy', label: 'IG Heavy' },
  { value: 'IGLight', label: 'IG Light' },
  { value: 'TCRAlpha', label: 'TCR-α' },
  { value: 'TCRBeta', label: 'TCR-β' },
  { value: 'TCRGamma', label: 'TCR-ɣ' },
  { value: 'TCRDelta', label: 'TCR-δ' },
];

const chains = computed({
  get: () => app.model.args.chains ?? 'IGHeavy',
  set: (value: string) => {
    app.model.args.chains = value;
  },
});

const clusteringOptions = [
  { value: 'relaxed', label: 'Relaxed error correction, faster assembly' },
  { value: 'default', label: 'Default MiXCR error correction, slower assembly' },
  { value: 'off', label: 'No error correction, fastest assembly' },
] as const;

const assemblingFeatureOptions = [
  { value: 'VDJRegion', label: 'VDJRegion' },
  { value: 'CDR3', label: 'CDR3' },
];

const assemblingFeature = computed<AssemblingFeature>({
  get: () => app.model.args.assemblingFeature as AssemblingFeature,
  set: (value: AssemblingFeature) => {
    app.model.args.assemblingFeature = value;
  },
});

const stopCodonOptions: ListOption<StopCodonType>[] = [
  { label: 'Amber (TAG)', value: 'amber' },
  { label: 'Ochre (TAA)', value: 'ochre' },
  { label: 'Opal/Umber (TGA)', value: 'opal' },
];

const aminoAcidOptions: ListOption[] = [
  { label: 'A (Ala)', value: 'A' },
  { label: 'C (Cys)', value: 'C' },
  { label: 'D (Asp)', value: 'D' },
  { label: 'E (Glu)', value: 'E' },
  { label: 'F (Phe)', value: 'F' },
  { label: 'G (Gly)', value: 'G' },
  { label: 'H (His)', value: 'H' },
  { label: 'I (Ile)', value: 'I' },
  { label: 'K (Lys)', value: 'K' },
  { label: 'L (Leu)', value: 'L' },
  { label: 'M (Met)', value: 'M' },
  { label: 'N (Asn)', value: 'N' },
  { label: 'P (Pro)', value: 'P' },
  { label: 'Q (Gln)', value: 'Q' },
  { label: 'R (Arg)', value: 'R' },
  { label: 'S (Ser)', value: 'S' },
  { label: 'T (Thr)', value: 'T' },
  { label: 'V (Val)', value: 'V' },
  { label: 'W (Trp)', value: 'W' },
  { label: 'Y (Tyr)', value: 'Y' },
];

const stopCodonSelection = computed({
  get: () => app.model.args.stopCodonTypes ?? [],
  set: (value: StopCodonType[]) => {
    app.model.args.stopCodonTypes = value.length > 0 ? value : undefined;
  },
});

const stopCodonReplacementModel = (type: StopCodonType) =>
  computed({
    get: () => app.model.args.stopCodonReplacements?.[type],
    set: (value: string | undefined) => {
      const current = app.model.args.stopCodonReplacements ?? {};
      if (value === undefined) {
        if (current[type] !== undefined) {
          delete current[type];
        }
        app.model.args.stopCodonReplacements = Object.keys(current).length > 0 ? current : undefined;
      } else {
        app.model.args.stopCodonReplacements = { ...current, [type]: value };
      }
    },
  });

const amberReplacement = stopCodonReplacementModel('amber');
const ochreReplacement = stopCodonReplacementModel('ochre');
const opalReplacement = stopCodonReplacementModel('opal');

watch(stopCodonSelection, (selected) => {
  const current = app.model.args.stopCodonReplacements;
  if (!current) return;
  const next = { ...current };
  for (const key of Object.keys(next) as StopCodonType[]) {
    if (!selected.includes(key)) delete next[key];
  }
  app.model.args.stopCodonReplacements = Object.keys(next).length > 0 ? next : undefined;
});

</script>

<template>
  <PlDropdownRef
    :options="app.model.outputs.inputOptions"
    :model-value="app.model.args.datasetRef"
    label="Select dataset"
    clearable
    :required="true"
    @update:model-value="setInput"
  />

  <PlTextArea
    v-model="app.model.ui.librarySequence"
    label="Reference sequence (FASTA format)"
    placeholder=">ref_name
ATCGATCGATCG..."
    :rows="8"
    :required="true"
    :error="fastaError"
  >
    <template #tooltip>
      Paste the nucleotide sequence(s) in FASTA format. Multiple FASTA records are supported. The header will be used as part of V and J gene names (e.g., header_Vgene, header_Jgene). The sequence must cover VDJRegion.
    </template>
  </PlTextArea>
  <PlDropdown
    v-model="chains"
    :options="chainOptions"
    label="Chain selection"
    :required="true"
  />

  <PlDropdown
    v-model="assemblingFeature"
    :options="assemblingFeatureOptions"
    label="Assembling feature"
  >
    <template #tooltip>
      Select the region used to assemble clonotypes.
    </template>
  </PlDropdown>

  <PlTextField
    v-model="app.model.args.tagPattern"
    label="Tag pattern"
    placeholder="e.g. ^N{16}CAGT(UMI:N{18})(R1:*)\^(R2:*)"
    clearable
  >
    <template #tooltip>
      Tag pattern for primer trimming, UMI extraction etc. Support MiXCR pattern syntax. Can be left empty.
    </template>
  </PlTextField>

  <PlAccordionSection label="Advanced Settings">
    <PlSectionSeparator>MiXCR Settings</PlSectionSeparator>
    <PlDropdown
      v-model="app.model.args.cloneClusteringMode"
      :options="clusteringOptions"
      label="Error correction"
    >
      <template #tooltip>
        'Default assembly' is the standard MiXCR clustering
        mode. 'Faster assembly' relaxes fuzzy matching
        criteria, speeding up assembly. 'Fastest assembly' further accelerates the process but disables error
        correction.
      </template>
    </PlDropdown>
    <PlTextField
      v-model="app.model.args.badQualityThreshold"
      :parse="parseNumber"
      :clearable="() => undefined"
      label="Assembly quality threshold"
      placeholder="15 (default)"
    >
      <template #tooltip>
        Per-position base quality threshold for clonotype assembly. Reads where all positions meet this threshold
        directly seed new clonotypes; reads with any position below it are deferred and mapped to existing clonotypes
        instead. Increase this value (e.g. 20–25) for long-read data (ONT, PacBio) to reduce memory usage and
        prevent erroneous reads from creating spurious clonotypes. Leave empty to use the MiXCR default (15).
      </template>
    </PlTextField>
    <PlNumberField
      v-model="app.model.args.limitInput"
      label="Take only this number of reads into analysis"
    />

    <PlSectionSeparator>Stop codon replacement</PlSectionSeparator>
    <PlDropdownMulti
      v-model="stopCodonSelection"
      label="Stop codons"
      :options="stopCodonOptions"
      clearable
    >
      <template #tooltip>
        Select stop codons to replace in amino acid sequences.
      </template>
    </PlDropdownMulti>
    <PlDropdown
      v-if="stopCodonSelection.includes('amber')"
      v-model="amberReplacement"
      :options="aminoAcidOptions"
      label="Replace Amber (TAG) with"
      clearable
    />
    <PlDropdown
      v-if="stopCodonSelection.includes('ochre')"
      v-model="ochreReplacement"
      :options="aminoAcidOptions"
      label="Replace Ochre (TAA) with"
      clearable
    />
    <PlDropdown
      v-if="stopCodonSelection.includes('opal')"
      v-model="opalReplacement"
      :options="aminoAcidOptions"
      label="Replace Opal/Umber (TGA) with"
      clearable
    />

    <PlSectionSeparator>Resource Allocation</PlSectionSeparator>
    <PlNumberField
      v-model="app.model.args.perProcessMemGB"
      label="Set memory per every sample process (GB)"
      :minValue="1"
    />

    <PlNumberField
      v-model="app.model.args.perProcessCPUs"
      label="Set CPUs number per every sample process"
      :minValue="1"
      :maxValue="999999"
    />
  </PlAccordionSection>
</template>
