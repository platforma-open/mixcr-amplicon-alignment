import type { BlockArgs, BlockOutputs, platforma } from '@platforma-open/milaboratories.mixcr-amplicon-alignment.model';
import {
  AlignReport,
  Qc,
} from '@platforma-open/milaboratories.mixcr-amplicon-alignment.model';
import { awaitStableState, blockTest } from '@platforma-sdk/test';
import { blockSpec as samplesAndDataBlockSpec } from '@platforma-open/milaboratories.samples-and-data';
import type { BlockArgs as SamplesAndDataBlockArgs } from '@platforma-open/milaboratories.samples-and-data.model';
import { uniquePlId } from '@platforma-open/milaboratories.samples-and-data.model';
import { blockSpec as myBlockSpec } from 'this-block';
import type { InferBlockState } from '@platforma-sdk/model';
import { wrapOutputs } from '@platforma-sdk/model';

// prettier-ignore
const referenceSequence = 'GAGGTGCAGCTCGTGGAGTCTGGGGGAGGCTTGGTCCAGCCTGGGGGGTCCCTGACACTTTCCTGTGCAGCCTCTGGATTCACCTTTAACACCTATTGGATGACCTGGGTCCGCCAGGCTCCAGGGAAGGGGCTGGAGTGGGTGGCCAATATAAATGAAGATGGAAGTGAAAACTACTATGCGGACTCTGTGAGGGGCCGATTCACCATTTTCAGAGACAACGCCAAGAACTCACTGTATCTGCAACTGAGCAGCCTGAGAGCCGAGGACACGTCTGTGTATTACTGTGCGAGATTCCGCGGGGGCCTTTGGGGCCAGGGAACCCTGGTCATTGTCTCCTCA';

blockTest('empty inputs', { timeout: 20000 }, async ({ rawPrj: project, expect }) => {
  const blockId = await project.addBlock('Block', myBlockSpec);
  const stableState = (await awaitStableState(
    project.getBlockState(blockId),
    15000,
  )) as InferBlockState<typeof platforma>;
  expect(stableState.outputs).toMatchObject({ inputOptions: { ok: true, value: [] } });
  const outputs = wrapOutputs(stableState.outputs);
  expect(outputs.started).toEqual(false);
});

blockTest(
  'simple project',
  { timeout: 300000 },
  async ({ rawPrj: project, ml, helpers, expect }) => {
    const sndBlockId = await project.addBlock('Samples & Data', samplesAndDataBlockSpec);
    const alignBlockId = await project.addBlock('MiXCR Amplicon Alignment', myBlockSpec);

    const sample1Id = uniquePlId();
    const dataset1Id = uniquePlId();

    const r1Handle = await helpers.getLocalFileHandle('./assets/s1_R1.fastq.gz');
    const r2Handle = await helpers.getLocalFileHandle('./assets/s1_R2.fastq.gz');

    await project.setBlockArgs(sndBlockId, {
      metadata: [],
      sampleIds: [sample1Id],
      sampleLabelColumnLabel: 'Sample Name',
      sampleLabels: { [sample1Id]: 'Sample 1' },
      datasets: [
        {
          id: dataset1Id,
          label: 'Dataset 1',
          content: {
            type: 'Fastq',
            readIndices: ['R1', 'R2'],
            gzipped: true,
            data: {
              [sample1Id]: {
                R1: r1Handle,
                R2: r2Handle,
              },
            },
          },
        },
      ],
    } satisfies SamplesAndDataBlockArgs);
    await project.runBlock(sndBlockId);
    await helpers.awaitBlockDone(sndBlockId, 8000);

    const sdnStableState = await helpers.awaitBlockDoneAndGetStableBlockState(sndBlockId, 8000);
    expect(sdnStableState.outputs).toMatchObject({
      fileImports: {
        ok: true,
        value: { [r1Handle]: { done: true }, [r2Handle]: { done: true } },
      },
    });

    // Wait for input options to propagate
    const alignBlockState = project.getBlockState(alignBlockId);
    const alignStableState1 = (await awaitStableState(
      alignBlockState,
      25000,
    )) as InferBlockState<typeof platforma>;

    expect(alignStableState1.outputs).toMatchObject({
      inputOptions: {
        ok: true,
        value: [
          {
            label: 'Dataset 1',
          },
        ],
      },
    });

    const alignOutputs1 = wrapOutputs(alignStableState1.outputs);

    // Configure the amplicon alignment block
    const vGenesFasta = `>ref_heavy\n${referenceSequence}`;
    const jGenesFasta = `>ref_heavy_j\n${referenceSequence.slice(-80)}`;

    // CDR3 region from the reference (Cys to Trp bounded region at VDJ junction)
    const cdr3Fasta = '>ref_heavy_cdr3\nTGTGCGAGATTCCGCGGGGGCCTTTGGGGC';

    await project.setBlockArgs(alignBlockId, {
      datasetRef: alignOutputs1.inputOptions[0].ref,
      chains: 'IGHeavy',
      tagPattern: '',
      vGenes: vGenesFasta,
      jGenes: jGenesFasta,
      cdr3Sequences: cdr3Fasta,
      assemblingFeature: 'VDJRegion',
      cloneClusteringMode: 'relaxed',
    } satisfies BlockArgs);

    const alignStableState2 = (await awaitStableState(
      project.getBlockState(alignBlockId),
      25000,
    )) as InferBlockState<typeof platforma>;

    const outputs2 = wrapOutputs<BlockOutputs>(alignStableState2.outputs);
    expect(outputs2.sampleLabels![sample1Id]).toBeDefined();

    // Run the block
    await project.runBlock(alignBlockId);
    const alignStableState3 = await helpers.awaitBlockDoneAndGetStableBlockState(
      alignBlockId,
      250000,
    );
    const outputs3 = wrapOutputs<BlockOutputs>(
      alignStableState3.outputs as unknown as BlockOutputs,
    );

    // Verify reports
    expect(outputs3.reports.isComplete).toEqual(true);

    const reportEntries = outputs3.reports.data;
    const alignJsonReportEntry = reportEntries.find(
      (entry) => entry.key[1] === 'align' && entry.key[2] === 'json',
    );
    expect(alignJsonReportEntry).toBeDefined();

    const alignReport = AlignReport.parse(
      JSON.parse(
        Buffer.from(
          await ml.driverKit.blobDriver.getContent(
            alignJsonReportEntry!.value!.handle as Parameters<
              typeof ml.driverKit.blobDriver.getContent
            >[0],
          ),
        ).toString('utf8'),
      ),
    );
    expect(alignReport).toBeDefined();
    expect(alignReport.totalReadsProcessed).greaterThan(0);

    // Verify QC
    const qcEntry = outputs3.qc!.data[0];
    expect(qcEntry).toBeDefined();

    const qc = Qc.parse(
      JSON.parse(
        Buffer.from(
          await ml.driverKit.blobDriver.getContent(
            qcEntry.value!.handle as Parameters<typeof ml.driverKit.blobDriver.getContent>[0],
          ),
        ).toString('utf8'),
      ),
    );
    expect(qc).toBeDefined();
  },
);

blockTest(
  'FR2:FR4 with imputation',
  { timeout: 300000 },
  async ({ rawPrj: project, ml, helpers, expect }) => {
    const sndBlockId = await project.addBlock('Samples & Data', samplesAndDataBlockSpec);
    const alignBlockId = await project.addBlock('MiXCR Amplicon Alignment', myBlockSpec);

    const sample1Id = uniquePlId();
    const dataset1Id = uniquePlId();

    const r1Handle = await helpers.getLocalFileHandle('./assets/s1_R1.fastq.gz');
    const r2Handle = await helpers.getLocalFileHandle('./assets/s1_R2.fastq.gz');

    await project.setBlockArgs(sndBlockId, {
      metadata: [],
      sampleIds: [sample1Id],
      sampleLabelColumnLabel: 'Sample Name',
      sampleLabels: { [sample1Id]: 'Sample 1' },
      datasets: [
        {
          id: dataset1Id,
          label: 'Dataset 1',
          content: {
            type: 'Fastq',
            readIndices: ['R1', 'R2'],
            gzipped: true,
            data: {
              [sample1Id]: {
                R1: r1Handle,
                R2: r2Handle,
              },
            },
          },
        },
      ],
    } satisfies SamplesAndDataBlockArgs);
    await project.runBlock(sndBlockId);

    await helpers.awaitBlockDoneAndGetStableBlockState(sndBlockId, 8000);

    // Wait for input options to propagate
    const alignStableState1 = (await awaitStableState(
      project.getBlockState(alignBlockId),
      25000,
    )) as InferBlockState<typeof platforma>;

    const alignOutputs1 = wrapOutputs(alignStableState1.outputs);

    // Configure the amplicon alignment block
    const vGenesFasta = `>ref_heavy\n${referenceSequence}`;
    const jGenesFasta = `>ref_heavy_j\n${referenceSequence.slice(-80)}`;

    const cdr3Fasta = '>ref_heavy_cdr3\nTGTGCGAGATTCCGCGGGGGCCTTTGGGGC';

    await project.setBlockArgs(alignBlockId, {
      datasetRef: alignOutputs1.inputOptions[0].ref,
      chains: 'IGHeavy',
      tagPattern: '',
      vGenes: vGenesFasta,
      jGenes: jGenesFasta,
      cdr3Sequences: cdr3Fasta,
      assemblingFeature: 'FR2:FR4',
      imputeGermline: true,
      cloneClusteringMode: 'relaxed',
    } satisfies BlockArgs);

    await project.runBlock(alignBlockId);
    const alignStableState3 = await helpers.awaitBlockDoneAndGetStableBlockState(
      alignBlockId,
      250000,
    );
    const outputs3 = wrapOutputs<BlockOutputs>(
      alignStableState3.outputs as unknown as BlockOutputs,
    );

    // Verify reports
    expect(outputs3.reports.isComplete).toEqual(true);

    const reportEntries = outputs3.reports.data;
    const alignJsonReportEntry = reportEntries.find(
      (entry) => entry.key[1] === 'align' && entry.key[2] === 'json',
    );
    expect(alignJsonReportEntry).toBeDefined();

    const alignReport = AlignReport.parse(
      JSON.parse(
        Buffer.from(
          await ml.driverKit.blobDriver.getContent(
            alignJsonReportEntry!.value!.handle as Parameters<
              typeof ml.driverKit.blobDriver.getContent
            >[0],
          ),
        ).toString('utf8'),
      ),
    );
    expect(alignReport).toBeDefined();
    expect(alignReport.totalReadsProcessed).greaterThan(0);

    const qcEntry = outputs3.qc!.data[0];
    expect(qcEntry).toBeDefined();
  },
);
