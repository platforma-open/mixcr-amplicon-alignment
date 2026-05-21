import type { DataModel, InferHrefType, PlDataTableStateV2 } from '@platforma-sdk/model';
import {
  BlockModelV3,
  DataModelBuilder,
  createPlDataTableStateV2,
  createPlDataTableV2,
  isPColumnSpec,
  parseResourceMap,
  type ImportFileHandle,
  type InferOutputsType,
} from '@platforma-sdk/model';
import type { BlockArgs, CloneClusteringMode, LegacyBlockArgs, LegacyBlockUiState, ReferenceInputMode } from './args';
import { ProgressPrefix } from './progress';

export type {
  CloneClusteringMode,
  AssemblingFeature,
  StopCodonType,
  ReferenceInputMode,
  VAnchorPoints,
  JAnchorPoints,
  LibraryEntryDefinition,
  StopCodonReplacements,
  BlockArgs,
  UiState,
  BlockArgsValid,
  LegacyBlockArgs,
  LegacyBlockUiState,
} from './args';

export type BlockData = BlockArgs & {
  // UI-only fields lifted from UiState
  referenceInputMode?: ReferenceInputMode;
  librarySequence?: string;
  selectedRecordHeaders?: string[];
  buildLibraryFastaFile?: ImportFileHandle;
  tableState: PlDataTableStateV2;
  // Run-mode
  runMode: 'dry' | 'full';
};

const dataModel = new DataModelBuilder()
  .from<BlockData>('v1')
  .upgradeLegacy<LegacyBlockArgs, LegacyBlockUiState>(({ args, uiState }) => ({
    ...args,
    referenceInputMode: uiState.referenceInputMode,
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
    cloneClusteringMode: 'off' as CloneClusteringMode,
    tagPattern: '',
    assemblingFeature: 'VDJRegion',
    imputeGermline: false,
    referenceInputMode: 'fastaSequence' as ReferenceInputMode,
    tableState: createPlDataTableStateV2(),
    runMode: 'full' as const,
  }));

export const platforma = BlockModelV3.create(dataModel as unknown as DataModel<BlockData & Record<string, unknown>>)

  // Args — explicit projection from BlockData → workflow args channel.
  // Validates all required fields by throwing, canonicalises tagPattern
  // (whitespace strip), and conditionally suppresses limitInput when
  // runMode === 'full' so a stale Preview value never leaks into Full runs.
  // Field channel per docs/superpowers/plans/2026-05-21-amplicon-v3-and-preview.field-audit.md.
  .args((data) => {
    if (data.datasetRef === undefined) throw new Error('Input dataset is required');
    if (!data.chains) throw new Error('Chain selection is required');
    if (data.runMode === 'dry' && (data.limitInput == null || data.limitInput <= 0)) {
      throw new Error('Read limit must be a positive integer for Preview mode');
    }

    const mode = data.referenceInputMode ?? 'fastaSequence';
    if (mode === 'libraryFile' && data.libraryFile === undefined) {
      throw new Error('Library file is required');
    }
    if (mode === 'buildLibrary' && (data.libraryEntries?.length ?? 0) === 0) {
      throw new Error('Library entries are required for Build Library mode');
    }
    if (mode !== 'libraryFile' && mode !== 'buildLibrary' && data.librarySequence === undefined && data.vGenes === undefined) {
      throw new Error('Reference sequence or V/J genes are required');
    }

    // Canonicalise tagPattern: strip leading/trailing whitespace so visually
    // equivalent inputs hash to the same CID.
    const tagPattern = data.tagPattern.trim();

    return {
      datasetRef: data.datasetRef,
      chains: data.chains,
      tagPattern,
      vGenes: data.vGenes,
      jGenes: data.jGenes,
      limitInput: data.runMode === 'dry' ? data.limitInput : undefined,
      perProcessMemGB: data.perProcessMemGB,
      perProcessCPUs: data.perProcessCPUs,
      cloneClusteringMode: data.cloneClusteringMode,
      assemblingFeature: data.assemblingFeature,
      badQualityThreshold: data.badQualityThreshold,
      disableLowQualityMapping: data.disableLowQualityMapping,
      stopCodonTypes: data.stopCodonTypes,
      stopCodonReplacements: data.stopCodonReplacements,
      referenceInputMode: data.referenceInputMode,
      libraryFile: data.libraryFile,
      isLibraryFileGzipped: data.isLibraryFileGzipped,
      imputeGermline: data.imputeGermline,
      libraryEntries: data.libraryEntries,
    };
  })

  // PrerunArgs — discovery fields for repseqio buildLibrary.
  // Pure projection: auto-reruns the library build when FASTA inputs change,
  // without requiring the user to press Run.
  // Field channel per docs/superpowers/plans/2026-05-21-amplicon-v3-and-preview.field-audit.md.
  .prerunArgs((data) => ({
    referenceInputMode: data.referenceInputMode,
    chains: data.chains,
    buildLibraryVGenes: data.buildLibraryVGenes,
    buildLibraryJGenes: data.buildLibraryJGenes,
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
        && v.axesSpec.some((a) => a.name === 'pl7.app/sampleId')
      );
    });
  })

  .retentiveOutput('hasMultiplexedFastq', (ctx) => {
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
        && v.axesSpec.some((a) => a.name === 'pl7.app/sampleGroupId')
      );
    }).length > 0;
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

  .sections((_ctx) => {
    return [
      { type: 'link', href: '/', label: 'Main' },
      { type: 'link', href: '/qc-report-table', label: 'QC Report Table' },
    ];
  })

  .output('isRunning', (ctx) => ctx.outputs?.getIsReadyOrError() === false)

  .output('libraryUploadProgress', (ctx) =>
    ctx.outputs?.resolve({ field: 'libraryImportHandle', allowPermanentAbsence: true })?.getImportProgress(), { isActive: true })

  .title(() => 'MiXCR Amplicon Alignment')

  .subtitle((ctx) => ctx.data.customBlockLabel || ctx.data.defaultBlockLabel || '')

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
export type Href = InferHrefType<typeof platforma>;
export * from './progress';
export * from './qc';
export * from './reports';
