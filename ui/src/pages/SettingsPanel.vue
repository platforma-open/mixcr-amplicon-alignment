<script setup lang="ts">
import type { PlRef } from '@platforma-sdk/model';
import {
  PlAccordionSection,
  PlDropdown,
  PlDropdownRef,
  PlNumberField,
  PlSectionSeparator,
  PlTextArea,
  PlTextField,
} from '@platforma-sdk/ui-vue';
import { computed, ref, watch } from 'vue';
import { useApp } from '../app';
import { retentive } from '../retentive';
import {
  validateFastaSequence,
  type FastaValidationResult,
} from '../utils/fastaValidator';

const app = useApp();
const inputOptions = retentive(computed(() => app.model.outputs.inputOptions));

// Validation state management
const fastaValidation = ref<FastaValidationResult | undefined>();

function setInput(inputRef: PlRef | undefined) {
  app.model.args.input = inputRef;
  if (inputRef)
    app.model.args.title = inputOptions.value?.find(
      (o) => o.ref.blockId === inputRef.blockId && o.ref.name === inputRef.name,
    )?.label;
  else app.model.args.title = undefined;
}

// Computed properties for new fields

const librarySequence = computed({
  get: () => app.model.args.librarySequence || undefined,
  set: (value: string) => {
    app.model.args.librarySequence = value;
  },
});

const _fivePrimePrimer = computed({
  get: () => app.model.args.fivePrimePrimer || '',
  set: (value: string) => {
    app.model.args.fivePrimePrimer = value;
  },
});

const _threePrimePrimer = computed({
  get: () => app.model.args.threePrimePrimer || '',
  set: (value: string) => {
    app.model.args.threePrimePrimer = value;
  },
});

// Check if library sequence is provided
const hasLibrarySequence = computed(() => {
  return (librarySequence.value || '').trim().length > 0;
});

// Watch for sequence changes and validate
watch(
  librarySequence,
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

// Validation rules for PlTextArea
const fastaValidationRules = [
  // Rule 1: Check if sequence is not empty
  (value: string): boolean | string => {
    if (!value || !value.trim()) {
      return 'FASTA sequence is required';
    }
    return true;
  },

  // Rule 2: Check if content looks like FASTA format
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
          return 'Headers cannot be empty. Please provide a name after ">" (e.g., ">gene_name").';
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

  // Rule 3: Use the comprehensive validation function for all other checks
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
  { value: 'none', label: 'Default assembly (standard clustering)' },
  { value: 'decrease', label: 'Faster assembly (relaxed matching)' },
  { value: 'off', label: 'Fastest assembly (no error correction)' },
] as const;

const cloneClusteringMode = computed({
  get: () =>
    app.model.args.cloneClusteringMode ?? 'none',
  set: (value) => {
    app.model.args.cloneClusteringMode = value;
  },
});

function parseNumber(v: string): number | undefined {
  if (!v || v.trim() === '') {
    return undefined;
  }

  const parsed = Number(v);

  if (!Number.isFinite(parsed)) {
    throw Error('Not a number');
  }

  return parsed;
}
</script>

<template>
  <PlSectionSeparator>Reference library options</PlSectionSeparator>
  <PlTextArea
    v-model="librarySequence"
    label="Reference sequence (FASTA format)"
    placeholder=">gene_name
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
  <PlSectionSeparator>MiXCR options</PlSectionSeparator>
  <PlDropdownRef
    :options="inputOptions"
    :model-value="app.model.args.input"
    label="Select dataset"
    clearable
    :disabled="!hasLibrarySequence || !fastaValidation?.isValid"
    :required="true"
    @update:model-value="setInput"
  />
  <PlAccordionSection label="Advanced Settings">
    <PlSectionSeparator>MiXCR options</PlSectionSeparator>
    <PlDropdown
      v-model="cloneClusteringMode"
      :options="clusteringOptions"
      label="Clustering presets"
    >
      <template #tooltip>
        'Default assembly' is the standard MiXCR clustering
        mode. 'Faster assembly' relaxes fuzzy matching
        criteria, speeding up assembly. 'Fastest assembly' further accelerates the process but disables error
        correction.
      </template>
    </PlDropdown>
    <PlTextField
      v-model="app.model.args.limitInput" :parse="parseNumber" :clearable="() => undefined"
      label="Take only this number of reads into analysis"
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
