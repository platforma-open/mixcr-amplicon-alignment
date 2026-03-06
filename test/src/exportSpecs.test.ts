import { test, expect, describe } from 'vitest';

/**
 * These tests replicate the key logic from calculate-export-specs.lib.tengo
 * to validate column naming for different assembling features with/without imputation.
 *
 * The tengo code cannot be directly imported, so we re-implement the core logic here
 * as a safety net to catch naming mismatches.
 */

// Mirrors formatAssemblingFeature in calculate-export-specs.lib.tengo
function formatAssemblingFeature(fstr: string): string {
  if (fstr === 'VDJRegion' || fstr === 'CDR3') return fstr;
  const parts = fstr.split(':');
  if (parts.length === 1) return `{${parts[0]}Begin:${parts[0]}End}`;
  return `{${parts[0]}Begin:${parts[1]}End}`;
}

// Mirrors the outputProductiveFeature logic
function outputProductiveFeature(assemblingFeature: string): string {
  const productive = formatAssemblingFeature(assemblingFeature);
  if (assemblingFeature !== 'VDJRegion' && assemblingFeature !== 'CDR3') {
    const parts = assemblingFeature.split(':');
    if (parts.length === 2) return `${parts[0]}_TO_${parts[1]}`;
  }
  return productive;
}

// Mirrors parseAssemblingFeature in calculate-export-specs.lib.tengo
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
  exportArgs: string[][];
  needsAssemblingFeatureExport: boolean;
  assemblingFeatureColumn?: string;
};

/**
 * Mirrors the clonotype key column logic from calculate-export-specs.lib.tengo
 */
function computeClonotypeKeyAndExport(
  assemblingFeature: string,
  imputeGermline: boolean,
): ClonotypeKeyResult {
  const parsed = parseAssemblingFeature(assemblingFeature);
  const imputedFeaturesMap: Record<string, boolean> = {};
  for (const f of parsed.imputed) imputedFeaturesMap[f] = true;

  const productive = formatAssemblingFeature(assemblingFeature);
  const outputProductive = outputProductiveFeature(assemblingFeature);

  let clonotypeKeyColumns: string[];
  const exportArgs: string[][] = [];

  if (assemblingFeature === 'CDR3') {
    clonotypeKeyColumns = ['nSeqCDR3', 'bestVGene', 'bestJGene'];
  } else {
    const isVdjImputed = imputedFeaturesMap['VDJRegion'] === true && imputeGermline;
    const vdjAvailable = imputedFeaturesMap['VDJRegion'] === undefined || imputeGermline;

    if (vdjAvailable) {
      const vdjColName = `nSeq${isVdjImputed ? 'Imputed' : ''}VDJRegion`;
      clonotypeKeyColumns = [vdjColName, 'bestVGene', 'bestJGene'];
    } else {
      const keyColName = `nSeq${outputProductive}`;
      clonotypeKeyColumns = [keyColName, 'bestVGene', 'bestJGene'];
    }
  }

  const isRangeFeature = assemblingFeature !== 'CDR3' && assemblingFeature !== 'VDJRegion';
  const vdjIsImputed = imputedFeaturesMap['VDJRegion'] === true;
  const needsAssemblingFeatureExport = isRangeFeature && vdjIsImputed && !imputeGermline;

  let assemblingFeatureColumn: string | undefined;
  if (needsAssemblingFeatureExport) {
    assemblingFeatureColumn = `nSeq${outputProductive}`;
    exportArgs.push(['-nFeature', productive]);
  }

  return {
    clonotypeKeyColumns,
    exportArgs,
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

describe('outputProductiveFeature', () => {
  test('CDR3 returns CDR3', () => {
    expect(outputProductiveFeature('CDR3')).toBe('CDR3');
  });

  test('VDJRegion returns VDJRegion', () => {
    expect(outputProductiveFeature('VDJRegion')).toBe('VDJRegion');
  });

  test('range feature converts to X_TO_Y format (MiXCR column naming)', () => {
    expect(outputProductiveFeature('CDR1:FR4')).toBe('CDR1_TO_FR4');
    expect(outputProductiveFeature('FR2:FR4')).toBe('FR2_TO_FR4');
    expect(outputProductiveFeature('CDR1:CDR3')).toBe('CDR1_TO_CDR3');
    expect(outputProductiveFeature('FR1:FR4')).toBe('FR1_TO_FR4');
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
    expect(result.nonImputed).toContain('CDR3');
    expect(result.nonImputed).toContain('FR1');
  });

  test('range feature CDR1:CDR3 puts VDJRegion in imputed', () => {
    const result = parseAssemblingFeature('CDR1:CDR3');
    expect(result.imputed).toContain('VDJRegion');
    expect(result.imputed).toContain('FR1');
    expect(result.imputed).toContain('FR4');
    expect(result.nonImputed).toContain('CDR1');
    expect(result.nonImputed).toContain('CDR3');
    expect(result.nonImputed).not.toContain('VDJRegion');
  });

  test('FR1:FR4 (full range) puts VDJRegion in nonImputed', () => {
    const result = parseAssemblingFeature('FR1:FR4');
    expect(result.nonImputed).toContain('VDJRegion');
    expect(result.imputed).toHaveLength(0);
  });

  test('FR2:FR4 puts FR1 and VDJRegion in imputed', () => {
    const result = parseAssemblingFeature('FR2:FR4');
    expect(result.imputed).toContain('FR1');
    expect(result.imputed).toContain('CDR1');
    expect(result.imputed).toContain('VDJRegion');
    expect(result.nonImputed).toContain('FR2');
    expect(result.nonImputed).toContain('FR4');
  });
});

describe('clonotype key columns', () => {
  test('CDR3: uses nSeqCDR3 as key', () => {
    const result = computeClonotypeKeyAndExport('CDR3', false);
    expect(result.clonotypeKeyColumns[0]).toBe('nSeqCDR3');
    expect(result.needsAssemblingFeatureExport).toBe(false);
  });

  test('VDJRegion: uses nSeqVDJRegion as key', () => {
    const result = computeClonotypeKeyAndExport('VDJRegion', false);
    expect(result.clonotypeKeyColumns[0]).toBe('nSeqVDJRegion');
    expect(result.needsAssemblingFeatureExport).toBe(false);
  });

  test('FR1:FR4 without imputation: VDJRegion is non-imputed, uses nSeqVDJRegion', () => {
    const result = computeClonotypeKeyAndExport('FR1:FR4', false);
    expect(result.clonotypeKeyColumns[0]).toBe('nSeqVDJRegion');
    expect(result.needsAssemblingFeatureExport).toBe(false);
  });

  test('CDR1:CDR3 without imputation: VDJRegion unavailable, uses nSeqCDR1_TO_CDR3', () => {
    const result = computeClonotypeKeyAndExport('CDR1:CDR3', false);
    expect(result.clonotypeKeyColumns[0]).toBe('nSeqCDR1_TO_CDR3');
    expect(result.needsAssemblingFeatureExport).toBe(true);
    expect(result.assemblingFeatureColumn).toBe('nSeqCDR1_TO_CDR3');
    // Export args should pass the MiXCR feature format
    expect(result.exportArgs[0]).toEqual(['-nFeature', '{CDR1Begin:CDR3End}']);
  });

  test('CDR1:FR4 without imputation: VDJRegion unavailable, uses nSeqCDR1_TO_FR4', () => {
    const result = computeClonotypeKeyAndExport('CDR1:FR4', false);
    expect(result.clonotypeKeyColumns[0]).toBe('nSeqCDR1_TO_FR4');
    expect(result.needsAssemblingFeatureExport).toBe(true);
    expect(result.assemblingFeatureColumn).toBe('nSeqCDR1_TO_FR4');
  });

  test('FR2:FR4 without imputation: VDJRegion unavailable, uses nSeqFR2_TO_FR4', () => {
    const result = computeClonotypeKeyAndExport('FR2:FR4', false);
    expect(result.clonotypeKeyColumns[0]).toBe('nSeqFR2_TO_FR4');
    expect(result.needsAssemblingFeatureExport).toBe(true);
  });

  test('CDR1:CDR3 WITH imputation: VDJRegion available (imputed), uses nSeqImputedVDJRegion', () => {
    const result = computeClonotypeKeyAndExport('CDR1:CDR3', true);
    expect(result.clonotypeKeyColumns[0]).toBe('nSeqImputedVDJRegion');
    expect(result.needsAssemblingFeatureExport).toBe(false);
  });

  test('FR2:FR4 WITH imputation: VDJRegion available (imputed), uses nSeqImputedVDJRegion', () => {
    const result = computeClonotypeKeyAndExport('FR2:FR4', true);
    expect(result.clonotypeKeyColumns[0]).toBe('nSeqImputedVDJRegion');
    expect(result.needsAssemblingFeatureExport).toBe(false);
  });

  test('FR1:FR4 WITH imputation: VDJRegion is non-imputed, uses nSeqVDJRegion', () => {
    const result = computeClonotypeKeyAndExport('FR1:FR4', true);
    expect(result.clonotypeKeyColumns[0]).toBe('nSeqVDJRegion');
    expect(result.needsAssemblingFeatureExport).toBe(false);
  });
});

describe('isProductive column name', () => {
  test('CDR3: isProductiveCDR3', () => {
    expect(`isProductive${outputProductiveFeature('CDR3')}`).toBe('isProductiveCDR3');
  });

  test('VDJRegion: isProductiveVDJRegion', () => {
    expect(`isProductive${outputProductiveFeature('VDJRegion')}`).toBe('isProductiveVDJRegion');
  });

  test('CDR1:FR4: isProductiveCDR1_TO_FR4 (matches MiXCR output)', () => {
    expect(`isProductive${outputProductiveFeature('CDR1:FR4')}`).toBe('isProductiveCDR1_TO_FR4');
  });

  test('FR2:FR4: isProductiveFR2_TO_FR4 (matches MiXCR output)', () => {
    expect(`isProductive${outputProductiveFeature('FR2:FR4')}`).toBe('isProductiveFR2_TO_FR4');
  });

  test('CDR1:CDR3: isProductiveCDR1_TO_CDR3 (matches MiXCR output)', () => {
    expect(`isProductive${outputProductiveFeature('CDR1:CDR3')}`).toBe('isProductiveCDR1_TO_CDR3');
  });
});
