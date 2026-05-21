import type { ImportFileHandle, PlDataTableStateV2, PlRef } from '@platforma-sdk/model';

export type CloneClusteringMode = 'relaxed' | 'default' | 'off';
export type AssemblingFeature = string;
export type StopCodonType = 'amber' | 'ochre' | 'opal';
export type ReferenceInputMode = 'fastaFile' | 'fastaSequence' | 'libraryFile' | 'buildLibrary';

export interface VAnchorPoints {
  fr1Begin: number;
  cdr1Begin: number;
  fr2Begin: number;
  cdr2Begin: number;
  fr3Begin: number;
  cdr3Begin: number;
  vEnd: number;
}

export interface JAnchorPoints {
  jBegin: number;
  fr4Begin: number;
  fr4End: number;
}

export interface LibraryEntryDefinition {
  name: string;
  vSequence: string;
  jSequence: string;
  vAnchorPoints: VAnchorPoints;
  jAnchorPoints: JAnchorPoints;
}

export interface StopCodonReplacements {
  amber?: string;
  ochre?: string;
  opal?: string;
}

export interface BlockArgs {
  defaultBlockLabel?: string;
  customBlockLabel?: string;
  datasetRef?: PlRef;
  chains?: string; // default: 'IGHeavy'
  title?: string;
  tagPattern: string;
  vGenes?: string; // now a single FASTA string
  jGenes?: string; // now a single FASTA string
  limitInput?: number;
  perProcessMemGB?: number; // 1GB or more required
  perProcessCPUs?: number; // 1 or more required
  cloneClusteringMode?: CloneClusteringMode; // default: 'off'
  assemblingFeature?: AssemblingFeature; // default: 'VDJRegion'
  badQualityThreshold?: number; // default: 15 (MiXCR default)
  disableLowQualityMapping?: boolean; // default: false; when true, passes maxBadPointsPercent=0 to MiXCR to skip the deferred-reads mapping phase
  stopCodonTypes?: StopCodonType[];
  stopCodonReplacements?: StopCodonReplacements;
  referenceFileHandle?: ImportFileHandle;
  libraryFile?: ImportFileHandle;
  isLibraryFileGzipped?: boolean;
  imputeGermline?: boolean;
  libraryEntries?: LibraryEntryDefinition[];
  buildLibraryVGenes?: string;
  buildLibraryJGenes?: string;
  referenceInputMode?: ReferenceInputMode;
}

export interface UiState {
  referenceInputMode?: ReferenceInputMode;
  librarySequence?: string;
  selectedRecordHeaders?: string[];
  buildLibraryFastaFile?: ImportFileHandle;
  tableState: PlDataTableStateV2;
}

export interface BlockArgsValid extends BlockArgs {
  dataset: PlRef;
  chains: string;
  librarySequence: string;
}

// V1 shapes — referenced by DataModelBuilder.upgradeLegacy below.
// Aliased here so the migration code reads as "legacy → V3" rather than
// "V1 args → V3 data".
export type LegacyBlockArgs = BlockArgs;
export type LegacyBlockUiState = UiState;
