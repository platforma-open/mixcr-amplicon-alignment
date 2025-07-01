<script setup lang="ts">
import type { PlRef } from "@platforma-sdk/model";
import {
  PlDropdownRef,
  PlTextField,
  PlSectionSeparator,
  PlTextArea,
} from "@platforma-sdk/ui-vue";
import { computed, ref, watch } from "vue";
import { useApp } from "../app";
import { retentive } from "../retentive";
import {
  validateLibrarySequence,
  type SequenceValidationResult,
} from "../utils/sequenceValidator";

const app = useApp();
const inputOptions = retentive(computed(() => app.model.outputs.inputOptions));

// Validation state management
const sequenceValidation = ref<SequenceValidationResult | undefined>();

function setInput(inputRef: PlRef | undefined) {
  app.model.args.input = inputRef;
  if (inputRef)
    app.model.args.title = inputOptions.value?.find(
      (o) => o.ref.blockId === inputRef.blockId && o.ref.name === inputRef.name
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

const fivePrimePrimer = computed({
  get: () => app.model.args.fivePrimePrimer || "",
  set: (value: string) => {
    app.model.args.fivePrimePrimer = value;
  },
});

const threePrimePrimer = computed({
  get: () => app.model.args.threePrimePrimer || "",
  set: (value: string) => {
    app.model.args.threePrimePrimer = value;
  },
});

// Check if library sequence is provided
const hasLibrarySequence = computed(() => {
  return (librarySequence.value || "").trim().length > 0;
});

// Watch for sequence changes and validate
watch(
  librarySequence,
  (newSequence) => {
    if ((newSequence || "").trim()) {
      sequenceValidation.value = validateLibrarySequence(newSequence || "");

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
  { immediate: true }
);

// Helper functions for validation display
const getSequenceError = (): string | undefined => {
  return sequenceValidation.value?.isValid === false
    ? sequenceValidation.value.error
    : undefined;
};
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 16px">
    <PlSectionSeparator>Reference library options</PlSectionSeparator>
    <div
      style="
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding-top: 16px;
      "
    >
      <PlTextArea
        v-model="librarySequence"
        label="Library sequence"
        placeholder="Paste DNA sequence here"
        :rows="5"
        :required="true"
      />

      <!-- Validation messages -->
      <div
        v-if="getSequenceError()"
        style="
          color: red;
          font-weight: bold;
          margin: 5px 0;
          padding: 5px;
          background: #fee;
          border: 1px solid #fcc;
        "
      >
        Error: {{ getSequenceError() }}
      </div>
    </div>

    <PlSectionSeparator>MiXCR options</PlSectionSeparator>
    <div
      style="
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding-top: 16px;
      "
    >
      <PlDropdownRef
        :options="inputOptions"
        :model-value="app.model.args.input"
        label="Select dataset"
        clearable
        :disabled="!hasLibrarySequence || !sequenceValidation?.isValid"
        :required="true"
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
  </div>
</template>
