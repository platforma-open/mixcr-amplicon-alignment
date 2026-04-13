<script setup lang="ts">
import type { ReferenceInputMode } from '@platforma-open/milaboratories.mixcr-amplicon-alignment.model';
import type { ImportFileHandle, LocalImportFileHandle, PlRef } from '@platforma-sdk/model';
import { getFilePathFromHandle, getRawPlatformaInstance } from '@platforma-sdk/model';
import {
  PlAccordionSection,
  PlBtnGroup,
  PlCheckbox,
  PlDropdown,
  PlDropdownMulti,
  PlDropdownRef,
  PlFileInput,
  PlNumberField,
  PlSectionSeparator,
  PlTextArea,
  PlTextField,
  type ListOption,
} from '@platforma-sdk/ui-vue';
import { computed, ref, watch } from 'vue';
import { useApp } from '../app';
import { parseFasta, parseFastaRecords } from '../utils/parseFasta';
import BuildLibraryPanel from './BuildLibraryPanel.vue';

const app = useApp();

const refModeOptions: ListOption<ReferenceInputMode>[] = [
  { label: 'FASTA sequence', value: 'fastaSequence' },
  { label: 'FASTA file', value: 'fastaFile' },
  { label: 'Library file', value: 'libraryFile' },
  { label: 'Build library', value: 'buildLibrary' },
];

const refMode = computed<ReferenceInputMode>({
  get: () => app.model.data.referenceInputMode ?? 'fastaSequence',
  set: (value: ReferenceInputMode) => {
    app.model.data.referenceInputMode = value;
  },
});

function extractFileName(filePath: string) {
  return filePath.replace(/^.*[\\/]/, '');
}

// Auto-detect gzip from library file
watch(
  () => app.model.data.libraryFile,
  async (newFile) => {
    if (!newFile) {
      app.model.data.isLibraryFileGzipped = undefined;
      return;
    }
    const libraryFileName = extractFileName(getFilePathFromHandle(newFile));
    const isGzipped = libraryFileName?.toLowerCase().endsWith('.gz') || false;
    app.model.data.isLibraryFileGzipped = isGzipped;
  },
);

const DRY_RUN_READS = 100_000;

const runModeOptions: ListOption<'dry' | 'full'>[] = [
  { label: 'Preview', value: 'dry' },
  { label: 'Full run', value: 'full' },
];

watch(
  () => app.model.data.runMode,
  (value) => {
    if (value === 'dry' && app.model.data.limitInput == null) {
      app.model.data.limitInput = DRY_RUN_READS;
    }
  },
);

type AssemblingFeature = string;
type StopCodonType = 'amber' | 'ochre' | 'opal';

// Validation state management
const fastaError = ref<string | undefined>();

// Record selection state
const allRecordHeaders = ref<string[]>([]);
const fileContent = ref<string | undefined>();

const recordOptions = computed(() =>
  allRecordHeaders.value.map((h) => ({ value: h, label: h })),
);

const selectedHeaders = computed({
  get: () => app.model.data.selectedRecordHeaders ?? allRecordHeaders.value,
  set: (value: string[]) => {
    app.model.data.selectedRecordHeaders = value;
  },
});

function revalidateFromContent(content: string) {
  const effectiveSelection = app.model.data.selectedRecordHeaders;
  const result = parseFasta(content, effectiveSelection);

  if (result.isValid) {
    fastaError.value = undefined;
    fileError.value = undefined;
    app.model.data.vGenes = result.vGenes;
    app.model.data.jGenes = result.jGenes;
  } else {
    fastaError.value = result.error;
    app.model.data.vGenes = undefined;
    app.model.data.jGenes = undefined;
  }

  return result;
}

function processContent(content: string) {
  const records = parseFastaRecords(content);
  const headers = records.map((r) => r.header).filter((h) => h.length > 0);
  allRecordHeaders.value = headers;

  // Prune stale selections
  if (app.model.data.selectedRecordHeaders) {
    const valid = app.model.data.selectedRecordHeaders.filter((h) => headers.includes(h));
    app.model.data.selectedRecordHeaders = valid.length > 0 ? valid : undefined;
  }

  return revalidateFromContent(content);
}

function clearRecordSelection() {
  allRecordHeaders.value = [];
  app.model.data.selectedRecordHeaders = undefined;
  fileContent.value = undefined;
}

function setInput(inputRef: PlRef | undefined) {
  app.model.data.datasetRef = inputRef;
  if (inputRef)
    app.model.data.title = app.model.outputs.inputOptions?.find(
      (o) => o.ref.blockId === inputRef.blockId && o.ref.name === inputRef.name,
    )?.label;
  else app.model.data.title = undefined;
}

const fileError = ref<string | undefined>();

async function setReferenceFile(file: ImportFileHandle | undefined) {
  if (!file) {
    fileError.value = undefined;
    app.model.data.vGenes = undefined;
    app.model.data.jGenes = undefined;
    clearRecordSelection();
    return;
  }

  try {
    const data = await getRawPlatformaInstance().lsDriver.getLocalFileContent(file as LocalImportFileHandle);
    const content = new TextDecoder().decode(data);
    fileContent.value = content;
    app.model.data.selectedRecordHeaders = undefined;
    const result = processContent(content);

    if (result.isValid) {
      // Clear paste input when file is set
      app.model.data.librarySequence = undefined;
    } else {
      fileError.value = result.error;
    }
  } catch (e) {
    fileError.value = `Failed to read file: ${e instanceof Error ? e.message : 'Unknown error'}`;
    app.model.data.vGenes = undefined;
    app.model.data.jGenes = undefined;
    clearRecordSelection();
  }
}

// Watch for sequence changes and validate (only in fastaSequence mode)
watch(
  () => app.model.data.librarySequence,
  (newSequence) => {
    if (refMode.value !== 'fastaSequence') return;
    if ((newSequence || '').trim()) {
      // Clear file input when text is entered
      app.model.data.referenceFileHandle = undefined;
      fileError.value = undefined;
      fileContent.value = undefined;
      app.model.data.selectedRecordHeaders = undefined;

      processContent(newSequence || '');
    } else {
      fastaError.value = undefined;
      app.model.data.vGenes = undefined;
      app.model.data.jGenes = undefined;
      clearRecordSelection();
    }
  },
  { immediate: true },
);

// Watch for selection changes and re-validate (does NOT write back to selectedRecordHeaders)
watch(
  () => app.model.data.selectedRecordHeaders,
  () => {
    const content = fileContent.value ?? app.model.data.librarySequence;
    if (content && content.trim()) {
      revalidateFromContent(content);
    }
  },
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
  get: () => app.model.data.chains ?? 'IGHeavy',
  set: (value: string) => {
    app.model.data.chains = value;
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
  { value: 'FR1:FR4', label: 'FR1:FR4' },
  { value: 'CDR1:FR4', label: 'CDR1:FR4' },
  { value: 'FR2:FR4', label: 'FR2:FR4' },
  { value: 'CDR2:FR4', label: 'CDR2:FR4' },
  { value: 'FR3:FR4', label: 'FR3:FR4' },
  { value: 'CDR3:FR4', label: 'CDR3:FR4' },
  { value: 'FR1:CDR3', label: 'FR1:CDR3' },
  { value: 'CDR1:CDR3', label: 'CDR1:CDR3' },
  { value: 'FR2:CDR3', label: 'FR2:CDR3' },
  { value: 'CDR2:CDR3', label: 'CDR2:CDR3' },
  { value: 'FR3:CDR3', label: 'FR3:CDR3' },
];

const assemblingFeature = computed<AssemblingFeature>({
  get: () => app.model.data.assemblingFeature as AssemblingFeature,
  set: (value: AssemblingFeature) => {
    app.model.data.assemblingFeature = value;
  },
});

const imputeGermline = computed({
  get: () => app.model.data.imputeGermline ?? false,
  set: (value: boolean) => {
    app.model.data.imputeGermline = value;
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
  get: () => app.model.data.stopCodonTypes ?? [],
  set: (value: StopCodonType[]) => {
    app.model.data.stopCodonTypes = value.length > 0 ? value : undefined;
  },
});

const stopCodonReplacementModel = (type: StopCodonType) =>
  computed({
    get: () => app.model.data.stopCodonReplacements?.[type],
    set: (value: string | undefined) => {
      const current = app.model.data.stopCodonReplacements ?? {};
      if (value === undefined) {
        if (current[type] !== undefined) {
          delete current[type];
        }
        app.model.data.stopCodonReplacements = Object.keys(current).length > 0 ? current : undefined;
      } else {
        app.model.data.stopCodonReplacements = { ...current, [type]: value };
      }
    },
  });

const amberReplacement = stopCodonReplacementModel('amber');
const ochreReplacement = stopCodonReplacementModel('ochre');
const opalReplacement = stopCodonReplacementModel('opal');

watch(stopCodonSelection, (selected) => {
  const current = app.model.data.stopCodonReplacements;
  if (!current) return;
  const next = { ...current };
  for (const key of Object.keys(next) as StopCodonType[]) {
    if (!selected.includes(key)) delete next[key];
  }
  app.model.data.stopCodonReplacements = Object.keys(next).length > 0 ? next : undefined;
});

</script>

<template>
  <PlDropdownRef
    :options="app.model.outputs.inputOptions"
    :model-value="app.model.data.datasetRef"
    label="Select dataset"
    clearable
    :required="true"
    @update:model-value="setInput"
  />

  <PlBtnGroup v-model="refMode" :options="refModeOptions" label="Reference input" />

  <template v-if="refMode === 'fastaFile'">
    <PlFileInput
      v-model="app.model.data.referenceFileHandle"
      label="Reference sequence file (FASTA)"
      :extensions="['fasta', 'fa']"
      :error="fileError"
      clearable
      @update:model-value="setReferenceFile"
    >
      <template #tooltip>
        Import a FASTA file with nucleotide reference sequence(s). Multiple FASTA records are supported. The header will be used as part of V and J gene names (e.g., header_Vgene, header_Jgene). The sequence must cover VDJRegion.
      </template>
    </PlFileInput>

    <PlDropdownMulti
      v-if="allRecordHeaders.length >= 2"
      v-model="selectedHeaders"
      :options="recordOptions"
      label="Select reference sequences"
      clearable
    >
      <template #tooltip>
        Choose which FASTA records to use. By default all records are selected.
      </template>
    </PlDropdownMulti>
  </template>

  <template v-else-if="refMode === 'fastaSequence'">
    <PlTextArea
      v-model="app.model.data.librarySequence"
      label="Paste reference sequence (FASTA format)"
      placeholder=">ref_name
ATCGATCGATCG..."
      :rows="8"
      :error="fastaError"
    >
      <template #tooltip>
        Paste the nucleotide sequence(s) in FASTA format. Multiple FASTA records are supported. The header will be used as part of V and J gene names (e.g., header_Vgene, header_Jgene). The sequence must cover VDJRegion.
      </template>
    </PlTextArea>

    <PlDropdownMulti
      v-if="allRecordHeaders.length >= 2"
      v-model="selectedHeaders"
      :options="recordOptions"
      label="Select reference sequences"
      clearable
    >
      <template #tooltip>
        Choose which FASTA records to use. By default all records are selected.
      </template>
    </PlDropdownMulti>
  </template>

  <template v-else-if="refMode === 'libraryFile'">
    <PlFileInput
      v-model="app.model.data.libraryFile"
      label="MiXCR library file"
      :extensions="['json']"
      clearable
    />
  </template>

  <BuildLibraryPanel v-else-if="refMode === 'buildLibrary'" />

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

  <PlCheckbox
    v-model="imputeGermline"
  >
    Impute non-covered parts from germline
  </PlCheckbox>

  <PlTextField
    v-model="app.model.data.tagPattern"
    label="Tag pattern"
    placeholder="e.g. ^N{16}CAGT(UMI:N{18})(R1:*)\^(R2:*)"
    clearable
  >
    <template #tooltip>
      Tag pattern for primer trimming, UMI extraction etc. Support MiXCR pattern syntax. Can be left empty.
    </template>
  </PlTextField>

  <PlBtnGroup v-model="app.model.data.runMode" :options="runModeOptions" label="Run mode">
    <template #tooltip>
      Preview — runs the analysis on a small fraction of reads per sample. Use it to check that settings are correct before processing the whole dataset.
    </template>
  </PlBtnGroup>

  <template v-if="app.model.data.runMode === 'dry'">
    <PlNumberField
      v-model="app.model.data.limitInput"
      label="Reads per sample limit"
      :clearable="true"
      :minValue="1"
      :validate="(v) => (Number.isInteger(v) ? undefined : 'Value must be an integer')"
      :error-message="app.model.data.limitInput == null ? 'Read limit is required for Preview mode' : undefined"
    >
      <template #tooltip>
        Number of reads to use per sample in the dry run. Recommended: 100,000 for a quick sanity check.
      </template>
    </PlNumberField>
  </template>

  <PlAccordionSection label="Advanced Settings">
    <PlSectionSeparator>MiXCR Settings</PlSectionSeparator>
    <PlDropdown
      v-model="app.model.data.cloneClusteringMode"
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
      v-model="app.model.data.badQualityThreshold"
      :clearable="() => 15"
      label="Assembly quality threshold"
      placeholder="15 (default)"
      :min-value="0"
      :step="1"
      :validate="(v) => (Number.isInteger(v) ? undefined : 'Value must be an integer')"
    >
      <template #tooltip>
        Per-position base quality threshold for clonotype assembly. Reads where all positions meet this threshold
        directly seed new clonotypes; reads with any position below it are deferred and mapped to existing clonotypes
        instead. Increase this value (e.g. 20–25) for long-read data (ONT, PacBio) to reduce memory usage and
        prevent erroneous reads from creating spurious clonotypes. Leave empty to use the MiXCR default (15).
      </template>
    </PlNumberField>

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
      v-model="app.model.data.perProcessMemGB"
      label="Set memory per every sample process (GB)"
      :minValue="1"
    />

    <PlNumberField
      v-model="app.model.data.perProcessCPUs"
      label="Set CPUs number per every sample process"
      :minValue="1"
      :maxValue="999999"
      :validate="(v) => (Number.isInteger(v) ? undefined : 'Value must be an integer')"
    />
  </PlAccordionSection>
</template>
