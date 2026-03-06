import { test, expect, describe } from 'vitest';

/**
 * These tests replicate the key logic from calculate-export-specs.lib.tengo
 * to validate column naming for different assembling features with/without imputation.
 *
 * MiXCR column naming rules (from repseqio GeneFeature.java):
 * - CDR3, VDJRegion: use name directly (isProductiveCDR3, nSeqVDJRegion)
 * - Ranges ending at FR4: named aliases (CDR1_TO_FR4, FR2_TO_FR4, CDR2_TO_FR4, FR3_TO_FR4)
 * - Other ranges: {XBegin:YEnd} format (e.g. {CDR1Begin:CDR3End})
 */

// Mirrors formatAssemblingFeature in calculate-export-specs.lib.tengo
function formatAssemblingFeature(fstr: string): string {
  if (fstr === 'VDJRegion' || fstr === 'CDR3') return fstr;
  const parts = fstr.split(':');
  if (parts.length === 1) return `{${parts[0]}Begin:${parts[0]}End}`;
  return `{${parts[0]}Begin:${parts[1]}End}`;
}

// Mirrors outputProductiveFeature logic
// MiXCR has named aliases for ranges ending at FR4; other ranges use {XBegin:YEnd}
function outputProductiveFeature(assemblingFeature: string): string {
  const productive = formatAssemblingFeature(assemblingFeature);
  if (assemblingFeature !== 'VDJRegion' && assemblingFeature !== 'CDR3') {
    const parts = assemblingFeature.split(':');
    if (parts.length === 2 && parts[1] === 'FR4') {
      return `${parts[0]}_TO_FR4`;
    }
  }
  return productive;
}

// Mirrors parseAssemblingFeature
function parseAssemblingFeature(assemblingFeature: string) {
  if (assemblingFeature === 'VDJRegion' || assemblingFeature === 'CDR3') {
    return {
      imputed: [] as string[],
      nonImputed: assemblingFeature === 'CDR3'
        ? ['CDR3']
        : ['CDR1', 'FR1', 'FR2', 'CDR2', 'FR3', 'CDR3', 'FR4', 'VDJRegion'],
    };
  }

  const features = ['FR1', 'CDR1', 'FR2', 'CDR2', 'FR3', 'CDR3', 'FR4'];
  const [begin, end] = assemblingFeature.split(':');
  const iBegin = features.indexOf(begin);
  const iEnd = features.indexOf(end);

  const imputed: string[] = [];
  const nonImputed: string[] = [];

  for (let i = 0; i < iBegin; i++) imputed.push(features[i]);
  for (let i = iEnd + 1; i < features.length; i++) imputed.push(features[i]);
  for (let i = iBegin; i <= iEnd; i++) nonImputed.push(features[i]);

  if (begin === 'FR1' && end === 'FR4') {
    nonImputed.push('VDJRegion');
  } else {
    imputed.push('VDJRegion');
  }

  return { imputed, nonImputed };
}

type ClonotypeKeyResult = {
  clonotypeKeyColumns: string[];
  needsAssemblingFeatureExport: boolean;
  assemblingFeatureColumn?: string;
};

function computeClonotypeKeyAndExport(
  assemblingFeature: string,
  _imputeGermline: boolean,
): ClonotypeKeyResult {
  const parsed = parseAssemblingFeature(assemblingFeature);
  const imputedFeaturesMap: Record<string, boolean> = {};
  for (const f of parsed.imputed) imputedFeaturesMap[f] = true;

  const outputProductive = outputProductiveFeature(assemblingFeature);

  let clonotypeKeyColumns: string[];

  if (assemblingFeature === 'CDR3') {
    clonotypeKeyColumns = ['nSeqCDR3', 'bestVGene', 'bestJGene'];
  } else {
    // VDJRegion is the assembling feature itself only when it's NOT in the imputed list
    const vdjIsAssemblingFeature = imputedFeaturesMap['VDJRegion'] === undefined;

    if (vdjIsAssemblingFeature) {
      // VDJRegion IS the assembling feature, use it directly
      clonotypeKeyColumns = ['nSeqVDJRegion', 'bestVGene', 'bestJGene'];
    } else {
      // Range feature: always use assembling feature as key (not imputed VDJRegion)
      const keyColName = `nSeq${outputProductive}`;
      clonotypeKeyColumns = [keyColName, 'bestVGene', 'bestJGene'];
    }
  }

  const isRangeFeature = assemblingFeature !== 'CDR3' && assemblingFeature !== 'VDJRegion';
  const vdjIsImputed = imputedFeaturesMap['VDJRegion'] === true;
  const needsAssemblingFeatureExport = isRangeFeature && vdjIsImputed;

  let assemblingFeatureColumn: string | undefined;
  if (needsAssemblingFeatureExport) {
    assemblingFeatureColumn = `nSeq${outputProductive}`;
  }

  return {
    clonotypeKeyColumns,
    needsAssemblingFeatureExport,
    assemblingFeatureColumn,
  };
}

// --- Tests ---

describe('formatAssemblingFeature', () => {
  test('CDR3 returns CDR3', () => {
    expect(formatAssemblingFeature('CDR3')).toBe('CDR3');
  });

  test('VDJRegion returns VDJRegion', () => {
    expect(formatAssemblingFeature('VDJRegion')).toBe('VDJRegion');
  });

  test('range feature returns {XBegin:YEnd}', () => {
    expect(formatAssemblingFeature('CDR1:FR4')).toBe('{CDR1Begin:FR4End}');
    expect(formatAssemblingFeature('FR2:FR4')).toBe('{FR2Begin:FR4End}');
    expect(formatAssemblingFeature('CDR1:CDR3')).toBe('{CDR1Begin:CDR3End}');
  });
});

describe('outputProductiveFeature (MiXCR column naming)', () => {
  test('CDR3 returns CDR3', () => {
    expect(outputProductiveFeature('CDR3')).toBe('CDR3');
  });

  test('VDJRegion returns VDJRegion', () => {
    expect(outputProductiveFeature('VDJRegion')).toBe('VDJRegion');
  });

  test('ranges ending at FR4 use named aliases (X_TO_FR4)', () => {
    expect(outputProductiveFeature('CDR1:FR4')).toBe('CDR1_TO_FR4');
    expect(outputProductiveFeature('FR2:FR4')).toBe('FR2_TO_FR4');
    expect(outputProductiveFeature('CDR2:FR4')).toBe('CDR2_TO_FR4');
    expect(outputProductiveFeature('FR3:FR4')).toBe('FR3_TO_FR4');
  });

  test('ranges NOT ending at FR4 use {XBegin:YEnd} format', () => {
    expect(outputProductiveFeature('CDR1:CDR3')).toBe('{CDR1Begin:CDR3End}');
    expect(outputProductiveFeature('FR2:CDR3')).toBe('{FR2Begin:CDR3End}');
    expect(outputProductiveFeature('CDR1:FR3')).toBe('{CDR1Begin:FR3End}');
  });
});

describe('parseAssemblingFeature', () => {
  test('CDR3 has no imputed features', () => {
    const result = parseAssemblingFeature('CDR3');
    expect(result.imputed).toEqual([]);
    expect(result.nonImputed).toEqual(['CDR3']);
  });

  test('VDJRegion includes all features as nonImputed', () => {
    const result = parseAssemblingFeature('VDJRegion');
    expect(result.imputed).toEqual([]);
    expect(result.nonImputed).toContain('VDJRegion');
  });

  test('CDR1:CDR3 puts VDJRegion and FR1,FR4 in imputed', () => {
    const result = parseAssemblingFeature('CDR1:CDR3');
    expect(result.imputed).toContain('VDJRegion');
    expect(result.imputed).toContain('FR1');
    expect(result.imputed).toContain('FR4');
    expect(result.nonImputed).toContain('CDR1');
    expect(result.nonImputed).toContain('CDR3');
  });

  test('FR1:FR4 (full range) puts VDJRegion in nonImputed', () => {
    const result = parseAssemblingFeature('FR1:FR4');
    expect(result.nonImputed).toContain('VDJRegion');
    expect(result.imputed).toHaveLength(0);
  });

  test('FR2:FR4 puts FR1, CDR1 and VDJRegion in imputed', () => {
    const result = parseAssemblingFeature('FR2:FR4');
    expect(result.imputed).toContain('FR1');
    expect(result.imputed).toContain('CDR1');
    expect(result.imputed).toContain('VDJRegion');
  });
});

describe('clonotype key columns', () => {
  test('CDR3: uses nSeqCDR3 as key', () => {
    const r = computeClonotypeKeyAndExport('CDR3', false);
    expect(r.clonotypeKeyColumns[0]).toBe('nSeqCDR3');
    expect(r.needsAssemblingFeatureExport).toBe(false);
  });

  test('VDJRegion: uses nSeqVDJRegion as key', () => {
    const r = computeClonotypeKeyAndExport('VDJRegion', false);
    expect(r.clonotypeKeyColumns[0]).toBe('nSeqVDJRegion');
    expect(r.needsAssemblingFeatureExport).toBe(false);
  });

  test('FR1:FR4 without imputation: VDJRegion non-imputed, uses nSeqVDJRegion', () => {
    const r = computeClonotypeKeyAndExport('FR1:FR4', false);
    expect(r.clonotypeKeyColumns[0]).toBe('nSeqVDJRegion');
    expect(r.needsAssemblingFeatureExport).toBe(false);
  });

  // Range ending at FR4 → MiXCR alias
  test('CDR1:FR4 without imputation: uses nSeqCDR1_TO_FR4 (MiXCR alias)', () => {
    const r = computeClonotypeKeyAndExport('CDR1:FR4', false);
    expect(r.clonotypeKeyColumns[0]).toBe('nSeqCDR1_TO_FR4');
    expect(r.needsAssemblingFeatureExport).toBe(true);
    expect(r.assemblingFeatureColumn).toBe('nSeqCDR1_TO_FR4');
  });

  test('FR2:FR4 without imputation: uses nSeqFR2_TO_FR4 (MiXCR alias)', () => {
    const r = computeClonotypeKeyAndExport('FR2:FR4', false);
    expect(r.clonotypeKeyColumns[0]).toBe('nSeqFR2_TO_FR4');
    expect(r.needsAssemblingFeatureExport).toBe(true);
  });

  // Range NOT ending at FR4 → {XBegin:YEnd} format
  test('CDR1:CDR3 without imputation: uses nSeq{CDR1Begin:CDR3End}', () => {
    const r = computeClonotypeKeyAndExport('CDR1:CDR3', false);
    expect(r.clonotypeKeyColumns[0]).toBe('nSeq{CDR1Begin:CDR3End}');
    expect(r.needsAssemblingFeatureExport).toBe(true);
    expect(r.assemblingFeatureColumn).toBe('nSeq{CDR1Begin:CDR3End}');
  });

  // With imputation → still uses assembling feature key (imputed VDJRegion is NOT unique per clone)
  test('CDR1:CDR3 WITH imputation: still uses nSeq{CDR1Begin:CDR3End} (not imputed VDJRegion)', () => {
    const r = computeClonotypeKeyAndExport('CDR1:CDR3', true);
    expect(r.clonotypeKeyColumns[0]).toBe('nSeq{CDR1Begin:CDR3End}');
    expect(r.needsAssemblingFeatureExport).toBe(true);
  });

  test('FR2:FR4 WITH imputation: still uses nSeqFR2_TO_FR4 (not imputed VDJRegion)', () => {
    const r = computeClonotypeKeyAndExport('FR2:FR4', true);
    expect(r.clonotypeKeyColumns[0]).toBe('nSeqFR2_TO_FR4');
    expect(r.needsAssemblingFeatureExport).toBe(true);
  });

  test('FR1:FR4 WITH imputation: VDJRegion non-imputed, uses nSeqVDJRegion', () => {
    const r = computeClonotypeKeyAndExport('FR1:FR4', true);
    expect(r.clonotypeKeyColumns[0]).toBe('nSeqVDJRegion');
    expect(r.needsAssemblingFeatureExport).toBe(false);
  });
});

describe('isProductive column naming (must match MiXCR output)', () => {
  test('CDR3: isProductiveCDR3', () => {
    expect(`isProductive${outputProductiveFeature('CDR3')}`).toBe('isProductiveCDR3');
  });

  test('VDJRegion: isProductiveVDJRegion', () => {
    expect(`isProductive${outputProductiveFeature('VDJRegion')}`).toBe('isProductiveVDJRegion');
  });

  test('FR2:FR4: isProductiveFR2_TO_FR4 (MiXCR named alias)', () => {
    expect(`isProductive${outputProductiveFeature('FR2:FR4')}`).toBe('isProductiveFR2_TO_FR4');
  });

  test('CDR1:FR4: isProductiveCDR1_TO_FR4 (MiXCR named alias)', () => {
    expect(`isProductive${outputProductiveFeature('CDR1:FR4')}`).toBe('isProductiveCDR1_TO_FR4');
  });

  test('CDR1:CDR3: isProductive{CDR1Begin:CDR3End} (no alias)', () => {
    const col = `isProductive${outputProductiveFeature('CDR1:CDR3')}`;
    expect(col).toBe('isProductive{CDR1Begin:CDR3End}');
  });
});
