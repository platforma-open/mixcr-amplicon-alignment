<script setup lang="ts">
import type { ImportFileHandle, LocalImportFileHandle } from '@platforma-sdk/model';
import { getRawPlatformaInstance } from '@platforma-sdk/model';
import type { LibraryEntryDefinition } from '@platforma-open/milaboratories.mixcr-amplicon-alignment.model';
import {
  PlFileInput,
  PlTextField,
  ReactiveFileContent,
} from '@platforma-sdk/ui-vue';
import { computed, reactive, ref, watch } from 'vue';
import { useApp } from '../app';
import { parseFasta } from '../utils/parseFasta';
import {
  getVRegions,
  getJRegions,
  recomposeVGene,
  recomposeJGene,
  translateDNA,
} from '../utils/buildLibrary';
import { parseRepseqioLibrary } from '../utils/parseRepseqioLibrary';

const app = useApp();

// Entry definitions bound to model args
const libraryEntries = computed({
  get: () => app.model.args.libraryEntries ?? [],
  set: (v: LibraryEntryDefinition[]) => { app.model.args.libraryEntries = v.length > 0 ? v : undefined; },
});

function addLibraryEntry() {
  const newIndex = libraryEntries.value.length;
  libraryEntries.value = [...libraryEntries.value, {
    name: '',
    vSequence: '',
    jSequence: '',
    vAnchorPoints: { fr1Begin: 0, cdr1Begin: 0, fr2Begin: 0, cdr2Begin: 0, fr3Begin: 0, cdr3Begin: 0, vEnd: 0 },
    jAnchorPoints: { jBegin: 0, fr4Begin: 0, fr4End: 0 },
  }];
  expandedEntries.add(newIndex);
}

function removeLibraryEntry(index: number) {
  expandedEntries.delete(index);
  const updated = new Set<number>();
  for (const i of expandedEntries) {
    if (i < index) updated.add(i);
    else if (i > index) updated.add(i - 1);
  }
  expandedEntries.clear();
  for (const i of updated) expandedEntries.add(i);
  libraryEntries.value = libraryEntries.value.filter((_, i) => i !== index);
}

// Collapse/expand state
const expandedEntries = reactive(new Set<number>());

function toggleEntry(index: number) {
  if (expandedEntries.has(index)) expandedEntries.delete(index);
  else expandedEntries.add(index);
}

// Region editing
type VRegionKey = 'fr1' | 'cdr1' | 'fr2' | 'cdr2' | 'fr3' | 'vPartCdr3';
type JRegionKey = 'jPartCdr3' | 'fr4';

function updateVRegion(entry: LibraryEntryDefinition, region: VRegionKey, value: string) {
  const regions = getVRegions(entry);
  regions[region] = value.toUpperCase();
  const { vSequence, vAnchorPoints } = recomposeVGene(regions);
  entry.vSequence = vSequence;
  entry.vAnchorPoints = vAnchorPoints;
}

function updateJRegion(entry: LibraryEntryDefinition, region: JRegionKey, value: string) {
  const regions = getJRegions(entry);
  regions[region] = value.toUpperCase();
  const { jSequence, jAnchorPoints } = recomposeJGene(regions);
  entry.jSequence = jSequence;
  entry.jAnchorPoints = jAnchorPoints;
}

// Region validation
const validNtPattern = /^[ACGTNRYSWKMBDHV]*$/i;

function regionCharError(seq: string): string | undefined {
  if (!seq) return undefined;
  if (!validNtPattern.test(seq)) return 'Only nucleotide (ACGT) and wildcard (N, IUPAC) symbols allowed';
  return undefined;
}

function regionLengthError(seq: string): string | undefined {
  if (!seq) return undefined;
  if (seq.length % 3 !== 0) return `Length must be a multiple of 3 (current: ${seq.length})`;
  return undefined;
}

function cdr3LengthError(vPartCdr3: string, jPartCdr3: string): string | undefined {
  const combined = (vPartCdr3?.length ?? 0) + (jPartCdr3?.length ?? 0);
  if (combined === 0) return undefined;
  if (combined % 3 !== 0) return `Combined CDR3 length must be a multiple of 3 (current: ${combined})`;
  return undefined;
}

function getRegionError(entry: LibraryEntryDefinition, region: VRegionKey | JRegionKey): string | undefined {
  const vRegions = getVRegions(entry);
  const jRegions = getJRegions(entry);

  const seq = region in vRegions
    ? vRegions[region as VRegionKey]
    : jRegions[region as JRegionKey];

  const charErr = regionCharError(seq);
  if (charErr) return charErr;

  if (region === 'vPartCdr3' || region === 'jPartCdr3') {
    return cdr3LengthError(vRegions.vPartCdr3, jRegions.jPartCdr3);
  }
  return regionLengthError(seq);
}

// FASTA upload → prerun sync
const buildLibraryFastaError = ref<string | undefined>();
type PrerunWaitState = 'idle' | 'waitForClear' | 'waitForResult';
const prerunWait = ref<PrerunWaitState>('idle');

async function onBuildLibraryFastaUpload(file: ImportFileHandle | undefined) {
  app.model.ui.buildLibraryFastaFile = file;

  if (!file) {
    buildLibraryFastaError.value = undefined;
    app.model.args.buildLibraryVGenes = undefined;
    app.model.args.buildLibraryJGenes = undefined;
    prerunWait.value = 'idle';
    libraryEntries.value = [];
    return;
  }

  try {
    const data = await getRawPlatformaInstance().lsDriver.getLocalFileContent(file as LocalImportFileHandle);
    const content = new TextDecoder().decode(data);
    const result = parseFasta(content);

    if (result.isValid) {
      buildLibraryFastaError.value = undefined;
      libraryEntries.value = [];
      prerunWait.value = app.model.outputs.prerunLibrary ? 'waitForClear' : 'waitForResult';
      app.model.args.buildLibraryVGenes = result.vGenes;
      app.model.args.buildLibraryJGenes = result.jGenes;
    } else {
      buildLibraryFastaError.value = result.error;
      app.model.args.buildLibraryVGenes = undefined;
      app.model.args.buildLibraryJGenes = undefined;
      prerunWait.value = 'idle';
      libraryEntries.value = [];
    }
  } catch (e) {
    buildLibraryFastaError.value = `Failed to read file: ${e instanceof Error ? e.message : 'Unknown error'}`;
    app.model.args.buildLibraryVGenes = undefined;
    app.model.args.buildLibraryJGenes = undefined;
    prerunWait.value = 'idle';
    libraryEntries.value = [];
  }
}

const reactiveFileContent = ReactiveFileContent.useGlobal();
const prerunLibraryLoading = computed(() => prerunWait.value !== 'idle');

// Phase 1: waitForClear → waitForResult when output goes undefined
watch(
  () => app.model.outputs.prerunLibrary,
  (val) => {
    if (prerunWait.value === 'waitForClear' && !val) {
      prerunWait.value = 'waitForResult';
    }
  },
);

// Phase 2: waitForResult → idle when content arrives
watch(
  () => {
    if (prerunWait.value !== 'waitForResult') return undefined;
    const blobHandleAndSize = app.model.outputs.prerunLibrary;
    if (!blobHandleAndSize) return undefined;
    return reactiveFileContent.getContentString(blobHandleAndSize.handle)?.value;
  },
  (content) => {
    if (!content || prerunWait.value !== 'waitForResult') return;
    const entries = parseRepseqioLibrary(content);
    if (entries.length > 0) {
      libraryEntries.value = entries;
      expandedEntries.clear();
    }
    prerunWait.value = 'idle';
  },
);
</script>

<template>
  <PlFileInput
    v-model="app.model.ui.buildLibraryFastaFile"
    label="Upload VDJ FASTA to auto-fill entries (optional)"
    :extensions="['fasta', 'fa']"
    :error="buildLibraryFastaError"
    clearable
    @update:model-value="onBuildLibraryFastaUpload"
  >
    <template #tooltip>
      Upload a FASTA file containing full VDJ nucleotide sequences. Anchor points will be inferred automatically using repseqio and entries will be populated below.
    </template>
  </PlFileInput>
  <div v-if="prerunLibraryLoading" class="prerun-loading">
    Inferring anchor points...
  </div>
  <div v-for="(entry, index) in libraryEntries" :key="index" class="library-entry">
    <div class="entry-header" @click="toggleEntry(index)">
      <span class="entry-chevron">{{ expandedEntries.has(index) ? '\u25BC' : '\u25B6' }}</span>
      <span class="entry-header-title">{{ entry.name || `Entry ${index + 1}` }}</span>
      <button class="entry-close-btn" @click.stop="removeLibraryEntry(index)">&times;</button>
    </div>
    <div v-if="expandedEntries.has(index)" class="entry-content">
      <div class="entry-name-row">
        <PlTextField v-model="entry.name" label="Entry name" />
      </div>

      <div class="gene-section-title">V gene ({{ entry.name ? entry.name + '_Vgene' : '...' }})</div>
      <div class="region-row">
        <div class="region-label">FR1</div>
        <PlTextField class="region-nt" :model-value="getVRegions(entry).fr1" :error="getRegionError(entry, 'fr1')" @update:model-value="(v: string) => updateVRegion(entry, 'fr1', v)" label="NT" />
        <div class="region-aa">{{ translateDNA(getVRegions(entry).fr1) || '-' }}</div>
      </div>
      <div class="region-row">
        <div class="region-label">CDR1</div>
        <PlTextField class="region-nt" :model-value="getVRegions(entry).cdr1" :error="getRegionError(entry, 'cdr1')" @update:model-value="(v: string) => updateVRegion(entry, 'cdr1', v)" label="NT" />
        <div class="region-aa">{{ translateDNA(getVRegions(entry).cdr1) || '-' }}</div>
      </div>
      <div class="region-row">
        <div class="region-label">FR2</div>
        <PlTextField class="region-nt" :model-value="getVRegions(entry).fr2" :error="getRegionError(entry, 'fr2')" @update:model-value="(v: string) => updateVRegion(entry, 'fr2', v)" label="NT" />
        <div class="region-aa">{{ translateDNA(getVRegions(entry).fr2) || '-' }}</div>
      </div>
      <div class="region-row">
        <div class="region-label">CDR2</div>
        <PlTextField class="region-nt" :model-value="getVRegions(entry).cdr2" :error="getRegionError(entry, 'cdr2')" @update:model-value="(v: string) => updateVRegion(entry, 'cdr2', v)" label="NT" />
        <div class="region-aa">{{ translateDNA(getVRegions(entry).cdr2) || '-' }}</div>
      </div>
      <div class="region-row">
        <div class="region-label">FR3</div>
        <PlTextField class="region-nt" :model-value="getVRegions(entry).fr3" :error="getRegionError(entry, 'fr3')" @update:model-value="(v: string) => updateVRegion(entry, 'fr3', v)" label="NT" />
        <div class="region-aa">{{ translateDNA(getVRegions(entry).fr3) || '-' }}</div>
      </div>
      <div class="region-row">
        <div class="region-label">V part CDR3</div>
        <PlTextField class="region-nt" :model-value="getVRegions(entry).vPartCdr3" :error="getRegionError(entry, 'vPartCdr3')" @update:model-value="(v: string) => updateVRegion(entry, 'vPartCdr3', v)" label="NT" />
        <div class="region-aa">{{ translateDNA(getVRegions(entry).vPartCdr3) || '-' }}</div>
      </div>

      <div class="gene-section-title">J gene ({{ entry.name ? entry.name + '_Jgene' : '...' }})</div>
      <div class="region-row">
        <div class="region-label">J part CDR3</div>
        <PlTextField class="region-nt" :model-value="getJRegions(entry).jPartCdr3" :error="getRegionError(entry, 'jPartCdr3')" @update:model-value="(v: string) => updateJRegion(entry, 'jPartCdr3', v)" label="NT" />
        <div class="region-aa">{{ translateDNA(getJRegions(entry).jPartCdr3) || '-' }}</div>
      </div>
      <div class="region-row">
        <div class="region-label">FR4</div>
        <PlTextField class="region-nt" :model-value="getJRegions(entry).fr4" :error="getRegionError(entry, 'fr4')" @update:model-value="(v: string) => updateJRegion(entry, 'fr4', v)" label="NT" />
        <div class="region-aa">{{ translateDNA(getJRegions(entry).fr4) || '-' }}</div>
      </div>
    </div>
  </div>
  <button class="gene-add-btn" @click="addLibraryEntry">+ Add entry</button>
</template>

<style scoped>
.library-entry {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  margin-bottom: 8px;
}

.entry-header {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  cursor: pointer;
  user-select: none;
  background: #fafafa;
  border-radius: 6px;
}

.library-entry:has(.entry-content) > .entry-header {
  border-radius: 6px 6px 0 0;
}

.entry-header:hover {
  background: #f0f0f0;
}

.entry-chevron {
  font-size: 10px;
  color: #888;
  margin-right: 8px;
  width: 12px;
  flex-shrink: 0;
}

.entry-header-title {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.entry-close-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 18px;
  line-height: 24px;
  text-align: center;
  color: #999;
  padding: 0;
  border-radius: 4px;
  flex-shrink: 0;
}

.entry-close-btn:hover {
  background: #fee;
  color: #c00;
}

.entry-content {
  padding: 12px;
  border-top: 1px solid #e0e0e0;
}

.entry-name-row {
  max-width: 50%;
}

.gene-section-title {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  color: #666;
  margin-top: 16px;
  margin-bottom: 12px;
  padding-top: 8px;
  border-top: 1px solid #e0e0e0;
}

.region-row {
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: 8px;
  align-items: start;
  margin-bottom: 4px;
}

.region-label {
  font-size: 13px;
  font-weight: 600;
  color: #555;
  padding-top: 10px;
}

.region-nt :deep(*) {
  min-width: 0;
  font-family: monospace;
}

.region-aa {
  grid-column: 2;
  font-family: monospace;
  font-size: 12px;
  color: #888;
  padding: 0 12px 4px;
  word-break: break-all;
}

.gene-add-btn {
  padding: 8px 16px;
  border: 1px dashed #ccc;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  width: 100%;
  margin-bottom: 8px;
  box-sizing: border-box;
}

.gene-add-btn:hover {
  background: #f5f5f5;
}

.prerun-loading {
  font-size: 13px;
  color: #888;
  padding: 8px 0;
  font-style: italic;
}
</style>
