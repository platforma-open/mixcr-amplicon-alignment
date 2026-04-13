import type { ImportFileHandle, InferHrefType, PlDataTableStateV2, PlRef } from '@platforma-sdk/model';
import {
  BlockModelV3,
  DataModelBuilder,
  createPlDataTableStateV2,
  createPlDataTableV2,
  isPColumnSpec,
  parseResourceMap,
  type InferOutputsType,
} from '@platforma-sdk/model';
import { ProgressPrefix } from './progress';

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

export type BlockArgs = {
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

export type UiState = {
  referenceInputMode?: ReferenceInputMode;
  librarySequence?: string;
  selectedRecordHeaders?: string[];
  buildLibraryFastaFile?: ImportFileHandle;
  tableState: PlDataTableStateV2;
};

export type BlockData = BlockArgs & {
  librarySequence?: string;
  selectedRecordHeaders?: string[];
  buildLibraryFastaFile?: ImportFileHandle;
  tableState: PlDataTableStateV2;
  runMode: 'dry' | 'full';
};

const dataModel = new DataModelBuilder()
  .from<BlockData>('v1')
  .upgradeLegacy<BlockArgs, UiState>(({ args, uiState }) => ({
    ...args,
    referenceInputMode: args.referenceInputMode ?? uiState.referenceInputMode ?? 'fastaSequence',
    librarySequence: uiState.librarySequence,
    selectedRecordHeaders: uiState.selectedRecordHeaders,
    buildLibraryFastaFile: uiState.buildLibraryFastaFile,
    tableState: uiState.tableState,
    runMode: (args.limitInput ?? 0) > 0 ? 'dry' : 'full',
  }))
  .init(() => ({
    defaultBlockLabel: '',
    customBlockLabel: '',
    chains: 'IGHeavy',
    cloneClusteringMode: 'off',
    tagPattern: '',
    assemblingFeature: 'VDJRegion',
    imputeGermline: false,
    referenceInputMode: 'fastaSequence',
    tableState: createPlDataTableStateV2(),
    runMode: 'full',
  }));

export const platforma = BlockModelV3.create(dataModel)

  .args((data) => {
    if (data.datasetRef === undefined) {
      throw new Error('Dataset is required');
    }
    const mode = data.referenceInputMode ?? 'fastaSequence';
    if (mode === 'libraryFile' && data.libraryFile === undefined) {
      throw new Error('Library file is required');
    }
    if (mode === 'buildLibrary' && (data.libraryEntries?.length ?? 0) === 0) {
      throw new Error('At least one library entry is required');
    }
    if (mode !== 'libraryFile' && mode !== 'buildLibrary' && data.vGenes === undefined) {
      throw new Error('V/J reference sequences are required');
    }
    if (data.runMode === 'dry' && data.limitInput == null) {
      throw new Error('Read limit is required for Preview mode');
    }
    return {
      defaultBlockLabel: data.defaultBlockLabel ?? '',
      customBlockLabel: data.customBlockLabel ?? '',
      datasetRef: data.datasetRef,
      chains: data.chains,
      title: data.title,
      tagPattern: data.tagPattern,
      vGenes: data.vGenes,
      jGenes: data.jGenes,
      limitInput: data.runMode === 'dry' ? data.limitInput : undefined,
      perProcessMemGB: data.perProcessMemGB,
      perProcessCPUs: data.perProcessCPUs,
      cloneClusteringMode: data.cloneClusteringMode,
      assemblingFeature: data.assemblingFeature,
      badQualityThreshold: data.badQualityThreshold,
      stopCodonTypes: data.stopCodonTypes,
      stopCodonReplacements: data.stopCodonReplacements,
      referenceFileHandle: data.referenceFileHandle,
      libraryFile: data.libraryFile,
      isLibraryFileGzipped: data.isLibraryFileGzipped,
      imputeGermline: data.imputeGermline,
      libraryEntries: data.libraryEntries,
      referenceInputMode: data.referenceInputMode,
    };
  })

  .prerunArgs((data) => ({
    referenceInputMode: data.referenceInputMode,
    buildLibraryVGenes: data.buildLibraryVGenes,
    buildLibraryJGenes: data.buildLibraryJGenes,
    chains: data.chains,
  }))

  .output('qc', (ctx) => {
    const acc = ctx.outputs?.resolve('qc');
    if (!acc || !acc.getInputsLocked()) return undefined;
    return parseResourceMap(acc, (acc) => acc.getFileHandle(), true);
  })

  .output('reports', (ctx) =>
    parseResourceMap(
      ctx.outputs?.resolve('reports'),
      (acc) => acc.getFileHandle(),
      false,
    ),
  )

  .output('logs', (ctx) => {
    return ctx.outputs !== undefined
      ? parseResourceMap(
          ctx.outputs?.resolve('logs'),
          (acc) => acc.getLogHandle(),
          false,
        )
      : undefined;
  })

  .output('progress', (ctx) => {
    return ctx.outputs !== undefined
      ? parseResourceMap(
          ctx.outputs?.resolve('logs'),
          (acc) => acc.getProgressLog(ProgressPrefix),
          false,
        )
      : undefined;
  })

  .output('referenceLibrary', (ctx) => {
    return ctx.outputs !== undefined
      ? ctx.outputs?.resolve({ field: 'referenceLibrary', assertFieldType: 'Input', allowPermanentAbsence: true })?.getRemoteFileHandle()
      : undefined;
  })

  .output('debugOutput', (ctx) => {
    return ctx.outputs !== undefined
      ? ctx.outputs?.resolve({ field: 'debugOutput', assertFieldType: 'Input', allowPermanentAbsence: true })?.getLogHandle()
      : undefined;
  })

  .output('started', (ctx) => ctx.outputs !== undefined)

  .output('done', (ctx) => {
    return ctx.outputs !== undefined
      ? parseResourceMap(
          ctx.outputs?.resolve('clns'),
          (_acc) => true,
          false,
        ).data.map((e) => e.key[0] as string)
      : undefined;
  })

  .output('prerunLibrary', (ctx) =>
    ctx.prerun?.resolve({ field: 'referenceLibrary', assertFieldType: 'Input', allowPermanentAbsence: true })?.getFileHandle(),
  )

  .retentiveOutput('inputOptions', (ctx) => {
    return ctx.resultPool.getOptions((v) => {
      if (!isPColumnSpec(v)) return false;
      const domain = v.domain;
      return (
        v.name === 'pl7.app/sequencing/data'
        && (v.valueType as string) === 'File'
        && domain !== undefined
        && (domain['pl7.app/fileExtension'] === 'fasta'
          || domain['pl7.app/fileExtension'] === 'fasta.gz'
          || domain['pl7.app/fileExtension'] === 'fastq'
          || domain['pl7.app/fileExtension'] === 'fastq.gz')
      );
    });
  })

  .output('sampleLabels', (ctx): Record<string, string> | undefined => {
    const inputRef = ctx.data.datasetRef;
    if (inputRef === undefined) return undefined;

    const spec = ctx.resultPool.getPColumnSpecByRef(inputRef);
    if (spec === undefined) return undefined;

    return ctx.resultPool.findLabelsForColumnAxis(spec, 0);
  })

  .output('rawTsvs', (ctx) => {
    if (ctx.outputs === undefined)
      return undefined;
    const pCols = ctx.outputs?.resolve('clonotypeTables')?.getPColumns();
    if (pCols === undefined) {
      return undefined;
    }
    return pCols.map((pCol) => {
      return {
        ...pCol,
        id: (JSON.parse(pCol.id) as { name: string }).name,
        data: parseResourceMap(pCol.data, (acc) => acc.getRemoteFileHandle(), false),
      };
    }).filter((pCol) => pCol.data.isComplete).map((pCol) => {
      return {
        ...pCol,
        data: pCol.data.data,
      };
    });
  })

  .outputWithStatus('pt', (ctx) => {
    const pCols = ctx.outputs?.resolve({ field: 'qcReportTable', assertFieldType: 'Input', allowPermanentAbsence: true })?.getPColumns();
    if (pCols === undefined) {
      return undefined;
    }
    return createPlDataTableV2(
      ctx,
      pCols,
      ctx.data.tableState,
    );
  })

  .output('isRunning', (ctx) => ctx.outputs?.getIsReadyOrError() === false)

  .output(
    'libraryUploadProgress',
    (ctx) => ctx.outputs?.resolve({ field: 'libraryImportHandle', allowPermanentAbsence: true })?.getImportProgress(),
    { isActive: true },
  )

  .sections((_ctx) => {
    return [
      { type: 'link', href: '/', label: 'Main' },
      { type: 'link', href: '/qc-report-table', label: 'QC Report Table' },
    ];
  })

  .title(() => 'MiXCR Amplicon Alignment')

  .subtitle((ctx) => ctx.data.customBlockLabel || ctx.data.defaultBlockLabel || '')

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
export type Href = InferHrefType<typeof platforma>;
export * from './progress';
export * from './qc';
export * from './reports';
