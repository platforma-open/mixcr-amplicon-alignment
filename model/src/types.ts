import type {
  AssemblingFeature,
  CloneClusteringMode,
  LibraryEntryDefinition,
  ReferenceInputMode,
  StopCodonReplacements,
  StopCodonType,
} from "@platforma-open/milaboratories.mixcr-amplicon-alignment.kind";
import type { ImportFileHandle, PlDataTableStateV2, PlRef } from "@platforma-sdk/model";

// The vocabulary lives in the kind: its init-params contract names these types
// and a kind cannot import from the model. Re-exported so the UI keeps a single
// import for both the block's own types and them.
export type * from "@platforma-open/milaboratories.mixcr-amplicon-alignment.kind";

/**
 * Unified V3 data: everything the block persists, shaped on the UI's terms.
 *
 * Pre-V3 this was split between `args` and `uiState`, and `referenceInputMode`
 * lived in both — the settings page wrote the UI copy and a watcher mirrored it
 * into args so the workflow could read it. One field replaces the pair here.
 */
export type BlockData = {
  /** Label the user typed. Wins over {@link defaultBlockLabel} in the subtitle. */
  customBlockLabel: string;
  /** Dataset, chains and assembling feature joined; recomputed by the main page. */
  defaultBlockLabel: string;
  datasetRef?: PlRef;
  /** Label of the chosen dataset, snapshotted from the input options. */
  title?: string;
  chains: string;
  tagPattern: string;
  referenceInputMode?: ReferenceInputMode;

  /** FASTA text typed or pasted into the reference field. */
  librarySequence?: string;
  /** File the reference FASTA was read from. Its parsed contents are what the workflow sees. */
  referenceFileHandle?: ImportFileHandle;
  /** Records kept out of the parsed FASTA; all of them when unset. */
  selectedRecordHeaders?: string[];
  /** V genes as a single FASTA string, parsed out of the reference by the UI. */
  vGenes?: string;
  /** J genes as a single FASTA string, parsed out of the reference by the UI. */
  jGenes?: string;

  libraryFile?: ImportFileHandle;
  /** Read off the library file's own name, so the workflow can decompress it. */
  isLibraryFileGzipped?: boolean;

  /** Entries of the hand-built library, in `buildLibrary` mode. */
  libraryEntries?: LibraryEntryDefinition[];
  /** File the build-library panel reads entries from. */
  buildLibraryFastaFile?: ImportFileHandle;
  /** V genes rendered from {@link libraryEntries}, for the prerun library preview. */
  buildLibraryVGenes?: string;
  /** J genes rendered from {@link libraryEntries}, for the prerun library preview. */
  buildLibraryJGenes?: string;

  cloneClusteringMode?: CloneClusteringMode;
  assemblingFeature?: AssemblingFeature;
  badQualityThreshold?: number;
  /** Passes `maxBadPointsPercent=0` to MiXCR, skipping the deferred-reads mapping phase. */
  disableLowQualityMapping?: boolean;
  imputeGermline?: boolean;
  stopCodonTypes?: StopCodonType[];
  stopCodonReplacements?: StopCodonReplacements;
  limitInput?: number;
  perProcessMemGB?: number;
  perProcessCPUs?: number;

  tableState: PlDataTableStateV2;
};

/**
 * Args consumed by the workflow.
 *
 * Deliberately the same shape the block sent before V3, down to the label
 * fields the workflow never reads: args are hashed to decide whether a block
 * must re-run, so dropping a field here would re-run MiXCR on every project
 * that upgrades.
 */
export type BlockArgs = {
  defaultBlockLabel?: string;
  customBlockLabel?: string;
  datasetRef?: PlRef;
  chains?: string;
  title?: string;
  tagPattern: string;
  vGenes?: string;
  jGenes?: string;
  limitInput?: number;
  perProcessMemGB?: number;
  perProcessCPUs?: number;
  cloneClusteringMode?: CloneClusteringMode;
  assemblingFeature?: AssemblingFeature;
  badQualityThreshold?: number;
  disableLowQualityMapping?: boolean;
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
};

/** Pre-V3 args shape, frozen snapshot for `upgradeLegacy`. */
export type LegacyBlockArgs = BlockArgs;

/** Pre-V3 UI state shape, frozen snapshot for `upgradeLegacy`. */
export type LegacyBlockUiState = {
  referenceInputMode?: ReferenceInputMode;
  librarySequence?: string;
  selectedRecordHeaders?: string[];
  buildLibraryFastaFile?: ImportFileHandle;
  tableState: PlDataTableStateV2;
};
