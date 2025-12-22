<script setup lang="ts">
import type { PlRef } from '@platforma-sdk/model';
import {
  PlAccordionSection,
  PlDropdown,
  PlDropdownRef,
  PlNumberField,
  PlTextArea,
  PlTextField,
} from '@platforma-sdk/ui-vue';
import { computed, ref, watch } from 'vue';
import { useApp } from '../app';
import { parseFasta } from '../utils/parseFasta';

const app = useApp();

type AssemblingFeature = 'VDJRegion' | 'CDR3';

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
      } else {
        // show error and clear sequences if validation fails
        fastaError.value = result.error;
        app.model.args.vGenes = undefined;
        app.model.args.jGenes = undefined;
      }
    } else {
      fastaError.value = undefined;
      app.model.args.vGenes = undefined;
      app.model.args.jGenes = undefined;
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
    <PlDropdown
      v-model="app.model.args.cloneClusteringMode"
      :options="clusteringOptions"
      label="Error correction"
    >
      <template #tooltip>
        <ul>
          <li><b>Default assembly:</b> The standard MiXCR clustering mode.</li>
          <li><b>Faster assembly:</b> Relaxes fuzzy matching criteria, speeding up assembly.</li>
          <li><b>Fastest assembly:</b> Further accelerates the process but disables error correction.</li>
        </ul>
      </template>
    </PlDropdown>
    <PlNumberField
      v-model="app.model.args.limitInput"
      label="Take only this number of reads into analysis"
    />
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
