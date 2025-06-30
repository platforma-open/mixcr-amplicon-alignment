import type {
  InferHrefType,
} from '@platforma-sdk/model';
import {
  BlockModel,
  It,
  MainOutputs,
  StagingOutputs,
  getImportProgress,
  getResourceField,
  isPColumn,
  isPColumnSpec,
  mapResourceFields,
  parseResourceMap,
  type InferOutputsType,
} from '@platforma-sdk/model';
import { BlockArgs, BlockArgsValid } from './args';
import { ProgressPrefix } from './progress';

export const platforma = BlockModel.create('Heavy')

  .withArgs<BlockArgs>({})

  .output('qc', (ctx) =>
    parseResourceMap(ctx.outputs?.resolve('qc'), (acc) => acc.getFileHandle(), true),
  )

  .output('reports', (ctx) =>
    parseResourceMap(ctx.outputs?.resolve('reports'), (acc) => acc.getFileHandle(), false),
  )

  .output('logs', (ctx) => {
    return ctx.outputs !== undefined
      ? parseResourceMap(ctx.outputs?.resolve('logs'), (acc) => acc.getLogHandle(), false)
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

  // .output('done', (ctx) => {
  //   return ctx.outputs !== undefined
  //     ? parseResourceMap(ctx.outputs?.resolve('clns'), (_acc) => true, false).data.map(
  //         (e) => e.key[0] as string,
  //       )
  //     : undefined;
  // })

  .output('clones', (ctx) => {
    const collection = ctx.outputs?.resolve('clones')?.parsePObjectCollection();
    if (collection === undefined) return undefined;
    const pColumns = Object.values(collection).filter(isPColumn);
    return ctx.createPFrame(pColumns);
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
    const inputRef = ctx.args.input;
    if (inputRef === undefined) return undefined;
    const inputSpec = ctx.resultPool
      .getSpecs()
      .entries.find(
        (obj) => obj.ref.blockId === inputRef.blockId && obj.ref.name === inputRef.name,
      )?.obj;
    if (inputSpec === undefined || !isPColumnSpec(inputSpec)) return undefined;
    const sampleAxisSpec = inputSpec.axesSpec[0];

    const sampleLabelsObj = ctx.resultPool.getData().entries.find((f) => {
      const spec = f.obj.spec;
      if (!isPColumnSpec(spec)) return false;
      if (spec.name !== 'pl7.app/label' || spec.axesSpec.length !== 1) return false;
      const axisSpec = spec.axesSpec[0];
      if (axisSpec.name !== sampleAxisSpec.name) return false;
      if (sampleAxisSpec.domain === undefined || Object.keys(sampleAxisSpec.domain).length === 0)
        return true;
      if (axisSpec.domain === undefined) return false;
      for (const [domainName, domainValue] of Object.entries(sampleAxisSpec.domain))
        if (axisSpec.domain[domainName] !== domainValue) return false;
      return true;
    });

    if (sampleLabelsObj === undefined) return undefined;

    return Object.fromEntries(
      Object.entries(
        sampleLabelsObj.obj.data.getDataAsJson<{ data: Record<string, string> }>().data,
      ).map((e) => [JSON.parse(e[0])[0], e[1]]),
    ) as Record<string, string>;
  })

  // .output(
  //   'mainFileImports',
  //   mapResourceFields(getResourceField(MainOutputs, 'fileImports'), getImportProgress(It)),
  // )

  // .output(
  //   'prerunFileImports',
  //   mapResourceFields(getResourceField(StagingOutputs, 'fileImports'), getImportProgress(It)),
  // )

  .sections((_ctx) => {
    return [{ type: 'link', href: '/', label: 'Main' }];
  })

  .argsValid((ctx) => BlockArgsValid.safeParse(ctx.args).success)

  .title((ctx) => (ctx.args.title ? `MiXCR Amplicon Alignment - ${ctx.args.title}` : 'MiXCR Amplicon Alignment'))

  .done();

export type BlockOutputs = InferOutputsType<typeof platforma>;
export type Href = InferHrefType<typeof platforma>;
export * from './args';
export * from './progress';
export * from './qc';
export * from './reports';
export { BlockArgs };
