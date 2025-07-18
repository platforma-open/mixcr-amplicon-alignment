<script setup lang="ts">
import type { PlRef } from '@platforma-sdk/model';
import {
  PlDropdownRef,
  PlSectionSeparator,
  PlTextArea,
  PlDropdown,
  PlAccordionSection,
  PlTextField,
} from '@platforma-sdk/ui-vue';
import { computed, ref, watch } from 'vue';
import { useApp } from '../app';
import { retentive } from '../retentive';
import {
  validateLibrarySequence,
  type SequenceValidationResult,
} from '../utils/sequenceValidator';

const app = useApp();
const inputOptions = retentive(computed(() => app.model.outputs.inputOptions));

// Validation state management
const sequenceValidation = ref<SequenceValidationResult | undefined>();

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
      sequenceValidation.value = validateLibrarySequence(newSequence || '');

      // If validation is successful, save the extracted sequences to args
      if (sequenceValidation.value?.isValid) {
        app.model.args.vGene = sequenceValidation.value.vGene;
        app.model.args.jGene = sequenceValidation.value.jGene;
      } else {
        // Clear sequences if validation fails
        app.model.args.vGene = undefined;
        app.model.args.jGene = undefined;
      }
    } else {
      sequenceValidation.value = undefined;
      app.model.args.vGene = undefined;
      app.model.args.jGene = undefined;
    }
  },
  { immediate: true },
);

// Validation rules for PlTextArea
const sequenceValidationRules = [
  // Rule 1: Check if sequence is not empty
  (value: string): boolean | string => {
    if (!value || !value.trim()) {
      return 'Sequence is required';
    }
    return true;
  },

  // Rule 2: Check if sequence contains only valid DNA nucleotides (ACGT) and IUPAC wildcards
  (value: string): boolean | string => {
    if (!value) return true; // Skip if empty (handled by first rule)
    const cleanSequence = value.toUpperCase().replace(/\s/g, '');
    // Only allow ACGT (standard DNA) and NRYWSKMBDHV (IUPAC wildcards)
    const validChars = /^[ACGTNRYWSKMBDHV]+$/;
    if (!validChars.test(cleanSequence)) {
      const invalidChars = cleanSequence.match(/[^ACGTNRYWSKMBDHV]/g);
      return `Only DNA nucleotides (ACGT) and IUPAC wildcards (NRYWSKMBDHV) are allowed. Invalid characters: ${invalidChars?.join(', ')}`;
    }
    return true;
  },

  // Rule 3: Check minimum length
  (value: string): boolean | string => {
    if (!value) return true; // Skip if empty (handled by first rule)
    const cleanSequence = value.toUpperCase().replace(/\s/g, '');
    if (cleanSequence.length < 250) {
      return 'Sequence has to cover VDJRegion';
    }
    return true;
  },

  // Rule 5: Check if sequence passes the complex validation pattern
  (value: string): boolean | string => {
    if (!value) return true; // Skip if empty (handled by first rule)

    // Use the existing validation function for complex pattern matching
    const validation = validateLibrarySequence(value);
    if (!validation.isValid) {
      return 'Sequence should contain V and J genes';
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
    label="Reference sequence"
    placeholder="Paste nucleotide sequence here"
    :rows="5"
    :required="true"
    :rules="sequenceValidationRules"
  >
    <template #tooltip>
      Paste the nucleotide sequence of the reference library. It has to cover VDJRegion.
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
    :disabled="!hasLibrarySequence || !sequenceValidationRules.every((rule) => rule(librarySequence || '') === true)"
    :required="true"
    @update:model-value="setInput"
  />
  <PlAccordionSection label="Advanced Settings">
    <PlTextField
      v-model="app.model.args.limitInput" :parse="parseNumber" :clearable="() => undefined"
      label="Take only this number of reads into analysis"
    />
  </PlAccordionSection>
</template>
