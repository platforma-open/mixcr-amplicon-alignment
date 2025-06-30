import type { AlignReport } from '../results';
import type {
  Color,
} from '@platforma-sdk/ui-vue';
import {
  Gradient,
} from '@platforma-sdk/ui-vue';
import type { Ref } from 'vue';
import { computed, unref } from 'vue';

export function getAlignmentChartSettings(alignReport: AlignReport | undefined) {
  const data = (() => {
    if (alignReport === undefined) return [];

    // Extract actual data from the alignment report
    const aligned = alignReport.aligned || 0;
    const notAligned = alignReport.notAligned || 0;
    const notAlignedReasons = alignReport.notAlignedReasons || {};
    
    const result = [
      { category: 'Success', value: aligned },
    ];

    // Add not aligned reasons
    for (const [reason, count] of Object.entries(notAlignedReasons)) {
      if (count > 0) {
        result.push({ category: reason, value: count });
      }
    }

    return result;
  })();

  const total = data.reduce((x, y) => x + y.value, 0);

  const viridis = Gradient('viridis');
  const magma = Gradient('magma');

  const categoryColors = {
    Success: viridis.getNthOf(2, 5),
    NoHits: magma.getNthOf(1, 9),
    NoCDR3Parts: magma.getNthOf(2, 9),
    NoVHits: magma.getNthOf(3, 9),
    NoJHits: magma.getNthOf(4, 9),
    VAndJOnDifferentTargets: magma.getNthOf(5, 9),
    LowTotalScore: magma.getNthOf(6, 9),
    NoBarcode: magma.getNthOf(7, 9),
    SampleNotMatched: magma.getNthOf(8, 9),
    FailedAfterAOverlap: magma.getNthOf(9, 9),
  } as Record<string, Color>;

  const categoryLabels: Record<string, string> = {
    Success: 'Successful Alignments',
    NoHits: 'No Gene Hits',
    NoCDR3Parts: 'No CDR3 Parts',
    NoVHits: 'No V Gene Hits',
    NoJHits: 'No J Gene Hits',
    VAndJOnDifferentTargets: 'V and J on Different Targets',
    LowTotalScore: 'Low Total Score',
    NoBarcode: 'No Barcode',
    SampleNotMatched: 'Sample Not Matched',
    FailedAfterAOverlap: 'Failed After A Overlap',
  };

  return {
    title: 'Alignments',
    data: data.map(({ category, value }) => {
      const color = categoryColors[category] || viridis.getNthOf(1, 5);
      return {
        label: categoryLabels[category] || category,
        value,
        color,
        description: [categoryLabels[category] || category, 'Fraction:' + (Math.round(value * 100 / total)) + '%'].join('\n'),
      };
    }),
  };
}

export function useAlignmentChartSettings(alignReportRef: Ref<AlignReport | undefined>) {
  return computed(() => {
    const alignReport = unref(alignReportRef);
    return getAlignmentChartSettings(alignReport);
  });
} 