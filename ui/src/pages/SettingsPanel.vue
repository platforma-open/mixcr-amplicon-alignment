<script setup lang="ts">
import type { PlRef } from '@platforma-sdk/model';
import { PlDropdownRef, PlTextField, PlAccordionSection, PlTextArea } from '@platforma-sdk/ui-vue';
import { computed, ref, watch } from 'vue';
import { useApp } from '../app';
import { retentive } from '../retentive';
import { validateLibrarySequence, type SequenceValidationResult } from '../utils/sequenceValidator';

const app = useApp();
const inputOptions = retentive(computed(() => app.model.outputs.inputOptions));

// Validation state management
const sequenceValidation = ref<SequenceValidationResult | undefined>();

function setInput(inputRef: PlRef | undefined) {
  app.model.args.input = inputRef;
  if (inputRef)
    app.model.args.title = inputOptions.value?.find((o) => o.ref.blockId === inputRef.blockId && o.ref.name === inputRef.name)?.label;
  else
    app.model.args.title = undefined;
}

// Computed properties for new fields
const libraryName = computed({
  get: () => app.model.args.libraryName || '',
  set: (value: string) => { app.model.args.libraryName = value; },
});

const librarySequence = computed({
  get: () => app.model.args.librarySequence || '',
  set: (value: string) => { app.model.args.librarySequence = value; },
});

const fivePrimePrimer = computed({
  get: () => app.model.args.fivePrimePrimer || '',
  set: (value: string) => { app.model.args.fivePrimePrimer = value; },
});

const threePrimePrimer = computed({
  get: () => app.model.args.threePrimePrimer || '',
  set: (value: string) => { app.model.args.threePrimePrimer = value; },
});

// Check if library sequence is provided
const hasLibrarySequence = computed(() => {
  return librarySequence.value.trim().length > 0;
});

// Watch for sequence changes and validate
watch(librarySequence, (newSequence) => {
  if (newSequence.trim()) {
    sequenceValidation.value = validateLibrarySequence(newSequence);

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
}, { immediate: true });

// Helper functions for validation display
const getSequenceError = (): string | undefined => {
  return sequenceValidation.value?.isValid === false ? sequenceValidation.value.error : undefined;
};

const getSequenceWarnings = (): string | undefined => {
  const validation = sequenceValidation.value;
  if (validation?.isValid && validation.warnings?.length) {
    return `Warnings: ${validation.warnings.join('; ')}`;
  }
  return undefined;
};

const getTranslatedSequence = (): string | undefined => {
  return sequenceValidation.value?.translatedSequence;
};
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 16px;">
    <PlAccordionSection label="Reference library options">
      <div style="display: flex; flex-direction: column; gap: 16px; padding-top: 16px">
        <PlTextField
          v-model="libraryName"
          label="Library name"
          clearable
        />
        <PlTextArea
          v-model="librarySequence"
          label="Library sequence"
          placeholder="Paste DNA sequence here"
          :rows="5"
        />

        <!-- Validation messages -->
        <div v-if="getSequenceError()" style="color: red; font-weight: bold; margin: 5px 0; padding: 5px; background: #fee; border: 1px solid #fcc;">
          ❌ Error: {{ getSequenceError() }}
        </div>

        <div v-if="getSequenceWarnings()" style="color: orange; font-weight: bold; margin: 5px 0; padding: 5px; background: #fff3cd; border: 1px solid #ffecb5;">
          ⚠️ {{ getSequenceWarnings() }}
        </div>

        <div v-if="sequenceValidation?.isValid && getTranslatedSequence()" style="color: green; font-weight: bold; margin: 5px 0; padding: 5px; background: #d4edda; border: 1px solid #c3e6cb;">
          ✅ Valid sequence. Translated protein: {{ getTranslatedSequence() }}
        </div>
      </div>
    </PlAccordionSection>

    <PlAccordionSection
      label="MiXCR options"
      :disabled="!hasLibrarySequence || !sequenceValidation?.isValid">
      <div style="display: flex; flex-direction: column; gap: 16px; padding-top: 16px">
        <PlDropdownRef
          :options="inputOptions"
          :model-value="app.model.args.input"
          label="Select dataset"
          clearable
          :disabled="!hasLibrarySequence || !sequenceValidation?.isValid"
          @update:model-value="setInput"
        />
        <PlTextField
          v-model="fivePrimePrimer"
          label="5' primer sequence"
          clearable
          :disabled="!hasLibrarySequence || !sequenceValidation?.isValid"
        />
        <PlTextField
          v-model="threePrimePrimer"
          label="3' primer sequence"
          clearable
          :disabled="!hasLibrarySequence || !sequenceValidation?.isValid"
        />
      </div>
    </PlAccordionSection>
    {{app.model.args.vGene}}
    {{app.model.args.jGene}}
  </div>
</template>
