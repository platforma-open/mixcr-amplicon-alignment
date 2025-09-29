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
import {
  validateFastaSequence,
  type FastaValidationResult,
} from '../utils/fastaValidator';

const app = useApp();

// Validation state management
const fastaValidation = ref<FastaValidationResult | undefined>();

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
      fastaValidation.value = validateFastaSequence(newSequence || '');

      // If validation is successful, save the extracted sequences to args
      if (fastaValidation.value?.isValid) {
        app.model.args.vGenes = fastaValidation.value.vGenes;
        app.model.args.jGenes = fastaValidation.value.jGenes;
      } else {
        // Clear sequences if validation fails
        app.model.args.vGenes = undefined;
        app.model.args.jGenes = undefined;
      }
    } else {
      fastaValidation.value = undefined;
      app.model.args.vGenes = undefined;
      app.model.args.jGenes = undefined;
    }
  },
  { immediate: true },
);

// Validation rules for PlTextArea (no error on empty input)
const fastaValidationRules = [
  // Rule: Check if content looks like FASTA format
  (value: string): boolean | string => {
    if (!value) return true; // Skip if empty (handled by first rule)

    const lines = value.trim().split('\n');
    let hasHeader = false;
    let hasSequence = false;
    let sequenceCount = 0;
    let headerCount = 0;
    let lastLineWasHeader = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      if (trimmedLine.startsWith('>')) {
        // Found a header - check if it's not empty
        if (trimmedLine.length === 1) {
          return 'Headers cannot be empty. Please provide a name after ">" (e.g., ">ref_name").';
        }
        hasHeader = true;
        headerCount++;
        lastLineWasHeader = true;
      } else {
        // Found a sequence line
        hasSequence = true;
        sequenceCount++;
        lastLineWasHeader = false;
      }
    }

    if (!hasSequence) {
      return 'FASTA content must contain sequence data';
    }

    // If we have headers, ensure every sequence has a header
    if (hasHeader) {
      if (headerCount !== sequenceCount) {
        return 'All sequences must have headers starting with ">". Found sequences without headers.';
      }
    } else {
      // No headers - ensure only single sequence
      if (sequenceCount > 1) {
        return 'Multiple sequences without headers detected. Please use FASTA format with headers (">sequence_name") or provide a single sequence.';
      }
    }

    // If the last line was a header, that's invalid (header without sequence)
    if (lastLineWasHeader) {
      return 'FASTA content ends with a header but no sequence. Each header must be followed by sequence data.';
    }

    return true;
  },

  // Rule: Use the comprehensive validation function for all other checks
  (value: string): boolean | string => {
    if (!value) return true; // Skip if empty (handled by first rule)

    // Use the existing validation function for all complex validation
    const validation = validateFastaSequence(value);
    if (!validation.isValid) {
      // Provide detailed error information
      let errorMessage = validation.error || 'Sequence validation failed';

      // Add specific error details if available
      if (validation.errors && validation.errors.length > 0) {
        if (validation.errors.length === 1) {
          errorMessage = validation.errors[0];
        } else {
          errorMessage = `Multiple validation errors:\n${validation.errors.join('\n')}`;
        }
      }

      return errorMessage;
    }
    return true;
  },
];

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
    :rules="fastaValidationRules"
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
        'Default assembly' is the standard MiXCR clustering
        mode. 'Faster assembly' relaxes fuzzy matching
        criteria, speeding up assembly. 'Fastest assembly' further accelerates the process but disables error
        correction.
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
