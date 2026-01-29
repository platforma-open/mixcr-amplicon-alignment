import type { InferHrefType, PlDataTableStateV2, PlRef } from '@platforma-sdk/model';
import {
  BlockModel,
  createPlDataTableV2,
  createPlDataTableStateV2,
  isPColumnSpec,
  parseResourceMap,
  type InferOutputsType,
} from '@platforma-sdk/model';
import { ProgressPrefix } from './progress';

export type CloneClusteringMode = 'relaxed' | 'default' | 'off';
export type AssemblingFeature = 'VDJRegion' | 'CDR3';
export type StopCodonType = 'amber' | 'ochre' | 'opal';

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
  cdr3Sequences?: string; // FASTA with CDR3 per reference
  limitInput?: number;
  perProcessMemGB?: number; // 1GB or more required
  perProcessCPUs?: number; // 1 or more required
  cloneClusteringMode?: CloneClusteringMode; // default: 'relaxed'
  assemblingFeature?: AssemblingFeature; // default: 'VDJRegion'
  stopCodonTypes?: StopCodonType[];
  stopCodonReplacements?: StopCodonReplacements;
}

export interface UiState {
  librarySequence?: string;
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
    cloneClusteringMode: 'relaxed',
    tagPattern: '',
    assemblingFeature: 'VDJRegion',
  })
  .withUiState<UiState>({
    tableState: createPlDataTableStateV2(),
  })

  .output('qc', (ctx) =>
    parseResourceMap(
      ctx.outputs?.resolve('qc'),
      (acc) => acc.getFileHandle(),
      true,
    ),
  )

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

  .output('debugOutput', (ctx) => {
    return ctx.outputs !== undefined
      ? ctx.outputs?.resolve('debugOutput')?.getLogHandle()
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
    const inputRef = ctx.args.datasetRef;
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
    return ctx.args.datasetRef !== undefined && ctx.uiState.librarySequence !== undefined;
  })

  .output('isRunning', (ctx) => ctx.outputs?.getIsReadyOrError() === false)

  .title(() => 'MiXCR Amplicon Alignment')

  .subtitle((ctx) => ctx.args.customBlockLabel || ctx.args.defaultBlockLabel || '')

  .done(2);

export type BlockOutputs = InferOutputsType<typeof platforma>;
export type Href = InferHrefType<typeof platforma>;
export * from './progress';
export * from './qc';
export * from './reports';
