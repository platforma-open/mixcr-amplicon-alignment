import { z } from 'zod';

export const ImmuneChain = z.union([
  z.literal(''),
  z.literal('TRA'),
  z.literal('TRAD'),
  z.literal('TRB'),
  z.literal('TRG'),
  z.literal('TRD'),
  z.literal('IGH'),
  z.literal('IGK'),
  z.literal('IGL'),
]);

export type ImmuneChain = z.infer<typeof ImmuneChain>;

export const NotAlignedReason = z.union([
  z.literal('NoHits'),
  z.literal('FailedAfterAOverlap'),
  z.literal('NoCDR3Parts'),
  z.literal('NoVHits'),
  z.literal('NoJHits'),
  z.literal('VAndJOnDifferentTargets'),
  z.literal('LowTotalScore'),
  z.literal('NoBarcode'),
  z.literal('SampleNotMatched'),
]);
export type NotAlignedReason = z.infer<typeof NotAlignedReason>;

export const AlignmentChannel = z.union([
  z.literal('Success'),
  z.literal('NoHits'),
  z.literal('NoCDR3Parts'),
  z.literal('NoVHits'),
  z.literal('NoJHits'),
  z.literal('VAndJOnDifferentTargets'),
  z.literal('LowTotalScore'),
  z.literal('NoBarcode'),
]);
export type AlignmentChannel = z.infer<typeof AlignmentChannel>;

export const AlignmentChannels = [
  'Success',
  'NoHits',
  'NoCDR3Parts',
  'NoVHits',
  'NoJHits',
  'VAndJOnDifferentTargets',
  'LowTotalScore',
  'NoBarcode',
] satisfies AlignmentChannel[];

export const AlignmentChannelLabels = {
  Success: 'Successfully aligned',
  NoHits: 'No hits (not TCR/IG?)',
  FailedAfterAOverlap: 'Failed after alignment-overlap',
  NoCDR3Parts: 'No CDR3 parts',
  NoVHits: 'No V hits',
  NoJHits: 'No J hits',
  VAndJOnDifferentTargets: 'No target with both V and J',
  LowTotalScore: 'Low total score',
  NoBarcode: 'Absent barcode',
  SampleNotMatched: 'Sample not matched',
} satisfies Record<NotAlignedReason | AlignmentChannel, string>;

export const AlignmentChannelColors = {
  Success: '#6BD67D',
  NoHits: '#FEE27A',
  FailedAfterAOverlap: 'red',
  NoCDR3Parts: '#FEBF51',
  NoVHits: '#FB9361',
  NoJHits: '#E75B64',
  VAndJOnDifferentTargets: '#B8397A',
  LowTotalScore: '#7E2583',
  NoBarcode: '#4B1979',
  SampleNotMatched: '#2B125C',
} satisfies Record<NotAlignedReason | AlignmentChannel, string>;

const ChainUsageEntry = z.object({
  total: z.number().int(),
  nonFunctional: z.number().int(),
  isOOF: z.number().int(),
  hasStops: z.number().int(),
});

const ChainUsage = z.object({
  chimeras: z.number().int(),
  total: z.number().int(),
  chains: z.record(ImmuneChain, ChainUsageEntry),
});

export const AlignReport = z.object({
  type: z.literal('alignerReport'),
  totalReadsProcessed: z.number().int(),
  aligned: z.number().int(),
  notAligned: z.number().int(),
  notAlignedReasons: z.record(NotAlignedReason, z.number().int()),
  overlapped: z.number().int(),
  overlappedAligned: z.number().int(),
  overlappedNotAligned: z.number().int(),
  alignmentAidedOverlaps: z.number().int(),
  noCDR3PartsAlignments: z.number().int(),
  partialAlignments: z.number().int(),
  chimeras: z.number().int(),
  vChimeras: z.number().int(),
  jChimeras: z.number().int(),
  pairedEndAlignmentConflicts: z.number().int(),
  realignedWithForcedNonFloatingBound: z.number().int(),
  realignedWithForcedNonFloatingRightBoundInLeftRead: z.number().int(),
  realignedWithForcedNonFloatingLeftBoundInRightRead: z.number().int(),
  chainUsage: ChainUsage,
});
export type AlignReport = z.infer<typeof AlignReport>;

export function extractAlignmentChannels(
  report: AlignReport,
): [AlignmentChannel, number][] {
  return AlignmentChannels.map((cId) => [
    cId,
    cId === 'Success' ? report.aligned : report.notAlignedReasons[cId] ?? 0,
  ]);
}
