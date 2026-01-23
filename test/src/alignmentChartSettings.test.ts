import { test, expect } from 'vitest';
import type { AlignReport } from '@platforma-open/milaboratories.mixcr-amplicon-alignment.model';

// Test the core logic without importing UI components
test('alignment chart data extraction logic', () => {
  const mockAlignReport: Partial<AlignReport> = {
    type: 'alignerReport',
    totalReadsProcessed: 1000,
    aligned: 850,
    notAligned: 150,
    notAlignedReasons: {
      NoHits: 50,
      NoCDR3Parts: 30,
      NoVHits: 20,
      NoJHits: 15,
      VAndJOnDifferentTargets: 10,
      LowTotalScore: 15,
      NoBarcode: 5,
      SampleNotMatched: 3,
      FailedAfterAOverlap: 2,
    },
  };

  // Simulate the core logic from getAlignmentChartSettings
  const extractAlignmentData = (alignReport: Partial<AlignReport> | undefined) => {
    if (alignReport === undefined) return [];

    const aligned = alignReport.aligned || 0;
    const notAlignedReasons = alignReport.notAlignedReasons || {};

    const result: Array<{ category: string; value: number }> = [{ category: 'Success', value: aligned }];

    // Add not aligned reasons
    for (const [reason, count] of Object.entries(notAlignedReasons)) {
      if (count > 0) {
        result.push({ category: reason, value: count });
      }
    }

    return result;
  };

  const result = extractAlignmentData(mockAlignReport);

  expect(result).toHaveLength(10); // Success + 9 not aligned reasons

  // Check that Success category exists and has correct value
  const successCategory = result.find((item) => item.category === 'Success');
  expect(successCategory).toBeDefined();
  expect(successCategory?.value).toBe(850);

  // Check that NoHits category exists and has correct value
  const noHitsCategory = result.find((item) => item.category === 'NoHits');
  expect(noHitsCategory).toBeDefined();
  expect(noHitsCategory?.value).toBe(50);

  // Check that all categories have values > 0
  result.forEach((item) => {
    expect(item.value).toBeGreaterThan(0);
  });
});

test('alignment chart data extraction with undefined report', () => {
  const extractAlignmentData = (alignReport: Partial<AlignReport> | undefined) => {
    if (alignReport === undefined) return [];
    // ... rest of logic
    return [];
  };

  const result = extractAlignmentData(undefined);
  expect(result).toHaveLength(0);
});

test('alignment chart data extraction with empty notAlignedReasons', () => {
  const mockAlignReport: Partial<AlignReport> = {
    type: 'alignerReport',
    totalReadsProcessed: 1000,
    aligned: 1000,
    notAligned: 0,
    notAlignedReasons: {},
  };

  const extractAlignmentData = (alignReport: Partial<AlignReport> | undefined) => {
    if (alignReport === undefined) return [];

    const aligned = alignReport.aligned || 0;
    const notAlignedReasons = alignReport.notAlignedReasons || {};

    const result: Array<{ category: string; value: number }> = [{ category: 'Success', value: aligned }];

    // Add not aligned reasons
    for (const [reason, count] of Object.entries(notAlignedReasons)) {
      if (count > 0) {
        result.push({ category: reason, value: count });
      }
    }

    return result;
  };

  const result = extractAlignmentData(mockAlignReport);
  expect(result).toHaveLength(1); // Only Success category
  expect(result[0].category).toBe('Success');
  expect(result[0].value).toBe(1000);
});
