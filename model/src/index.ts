import type { ImportFileHandle, InferHrefType, PlDataTableStateV2, PlRef } from '@platforma-sdk/model';
import {
  BlockModel,
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
  demuxPattern?: string;
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

export const platforma = BlockModel.create('Heavy')

  .withArgs<BlockArgs>({
    defaultBlockLabel: '',
    customBlockLabel: '',
    chains: 'IGHeavy',
    cloneClusteringMode: 'off',
    tagPattern: '',
    assemblingFeature: 'VDJRegion',
    imputeGermline: false,
  })
  .withUiState<UiState>({
    referenceInputMode: 'fastaSequence',
    tableState: createPlDataTableStateV2(),
  })

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

  .output('mitoolLogs', (ctx) => {
    return ctx.outputs !== undefined
      ? parseResourceMap(
          ctx.outputs?.resolve({ field: 'mitoolLogs', assertFieldType: 'Input', allowPermanentAbsence: true }),
          (acc) => acc.getLogHandle(),
          false,
        )
      : undefined;
  })

  .output('barcodeIdValid', (ctx): boolean | undefined =>
    ctx.prerun?.resolve({ field: 'barcodeIdValid', assertFieldType: 'Input', allowPermanentAbsence: true })?.getDataAsJson(),
  )

  .output('barcodeIdValidationMessage', (ctx): string | undefined =>
    ctx.prerun?.resolve({ field: 'barcodeIdValidationMessage', assertFieldType: 'Input', allowPermanentAbsence: true })?.getDataAsJson(),
  )

  .output('sampleGroups', (ctx): Record<string, Record<string, string>> | undefined =>
    ctx.prerun?.resolve({ field: 'sampleGroups', assertFieldType: 'Input', allowPermanentAbsence: true })?.getDataAsJson(),
  )

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

  // Stable "is this dataset multiplexed?" signal derived from the input spec,
  // not the prerun. Prerun re-runs on every args change and its outputs blip
  // through undefined, which would flicker any UI gated on `sampleGroups`.
  .output('isMultiplexed', (ctx): boolean => {
    const inputRef = ctx.args.datasetRef;
    if (inputRef === undefined) return false;
    const spec = ctx.resultPool.getPColumnSpecByRef(inputRef);
    return spec?.axesSpec?.[0]?.name === 'pl7.app/sampleGroupId';
  })

  .output('sampleLabels', (ctx): Record<string, string> | undefined => {
    const inputRef = ctx.args.datasetRef;
    if (inputRef === undefined) return undefined;

    const spec = ctx.resultPool.getPColumnSpecByRef(inputRef);
    if (spec === undefined) return undefined;

    // For multiplexed input (groupId axis), build flat sampleId -> label map from prerun sampleGroups
    if (spec.axesSpec?.[0]?.name === 'pl7.app/sampleGroupId') {
      const sampleGroups: Record<string, Record<string, string>> | undefined = ctx.prerun
        ?.resolve({ field: 'sampleGroups', assertFieldType: 'Input', allowPermanentAbsence: true })
        ?.getDataAsJson();
      if (sampleGroups === undefined) return undefined;
      const labels: Record<string, string> = {};
      for (const groupSamples of Object.values(sampleGroups)) {
        for (const [sampleId, sampleLabel] of Object.entries(groupSamples)) {
          labels[sampleId] = sampleLabel;
        }
      }
      return labels;
    }

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
      ctx.uiState.tableState,
    );
  })

  .sections((_ctx) => {
    return [
      { type: 'link', href: '/', label: 'Main' },
      { type: 'link', href: '/qc-report-table', label: 'QC Report Table' },
    ];
  })

  .argsValid((ctx) => {
    const mode = ctx.uiState.referenceInputMode ?? 'fastaSequence';
    const hasDataset = ctx.args.datasetRef !== undefined;
    if (mode === 'libraryFile') {
      return hasDataset && ctx.args.libraryFile !== undefined;
    }
    if (mode === 'buildLibrary') {
      return hasDataset && (ctx.args.libraryEntries?.length ?? 0) > 0;
    }
    return hasDataset && (ctx.uiState.librarySequence !== undefined || ctx.args.vGenes !== undefined);
  })

  .output('isRunning', (ctx) => ctx.outputs?.getIsReadyOrError() === false)

  .output('libraryUploadProgress', (ctx) =>
    ctx.outputs?.resolve({ field: 'libraryImportHandle', allowPermanentAbsence: true })?.getImportProgress(), { isActive: true })

  .title(() => 'MiXCR Amplicon Alignment')

  .subtitle((ctx) => ctx.args.customBlockLabel || ctx.args.defaultBlockLabel || '')

  .done(2);

export type BlockOutputs = InferOutputsType<typeof platforma>;
export type Href = InferHrefType<typeof platforma>;
export * from './progress';
export * from './qc';
export * from './reports';
