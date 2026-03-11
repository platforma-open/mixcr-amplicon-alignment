interface LibraryGene {
  baseSequence: string;
  name: string;
  geneType: string;
  anchorPoints: Record<string, number>;
}

interface SequenceFragment {
  uri: string;
  range: { from: number; to: number };
  sequence: string;
}

interface LibraryEntry {
  genes: LibraryGene[];
  sequenceFragments: SequenceFragment[];
}

/**
 * Extracts CDR3 nucleotide sequences from a MiXCR library.json file.
 *
 * For each V/J gene pair (matched by name prefix, e.g. "ref_Vgene" + "ref_Jgene"),
 * reconstructs CDR3 = V[CDR3Begin:VEnd] + J[JBegin:FR4Begin] using the embedded
 * sequence fragments and anchor points.
 *
 * @returns FASTA string with CDR3 sequences, or undefined if extraction fails.
 */
export function extractCdr3FromLibrary(jsonContent: string): string | undefined {
  let entries: LibraryEntry[];
  try {
    entries = JSON.parse(jsonContent);
  } catch {
    return undefined;
  }

  if (!Array.isArray(entries)) return undefined;

  const cdr3Parts: string[] = [];

  for (const entry of entries) {
    const fragments = entry.sequenceFragments ?? [];

    const resolveSequence = (gene: LibraryGene): string | undefined => {
      const frag = fragments.find((f) => f.uri === gene.baseSequence);
      if (!frag) return undefined;
      return frag.sequence;
    };

    // Index V and J genes by name prefix
    const vGenes = new Map<string, LibraryGene>();
    const jGenes = new Map<string, LibraryGene>();

    for (const gene of entry.genes) {
      if (gene.geneType === 'V' && gene.name.endsWith('_Vgene')) {
        const prefix = gene.name.slice(0, -'_Vgene'.length);
        vGenes.set(prefix, gene);
      } else if (gene.geneType === 'J' && gene.name.endsWith('_Jgene')) {
        const prefix = gene.name.slice(0, -'_Jgene'.length);
        jGenes.set(prefix, gene);
      }
    }

    for (const [prefix, vGene] of vGenes) {
      const jGene = jGenes.get(prefix);
      if (!jGene) continue;

      const cdr3Begin = vGene.anchorPoints.CDR3Begin;
      const vEnd = vGene.anchorPoints.VEnd;
      const jBegin = jGene.anchorPoints.JBegin;
      const fr4Begin = jGene.anchorPoints.FR4Begin;

      if (cdr3Begin === undefined || vEnd === undefined || jBegin === undefined || fr4Begin === undefined) {
        continue;
      }

      const vSeq = resolveSequence(vGene);
      const jSeq = resolveSequence(jGene);
      if (!vSeq || !jSeq) continue;

      const vFrag = fragments.find((f) => f.uri === vGene.baseSequence);
      const jFrag = fragments.find((f) => f.uri === jGene.baseSequence);
      if (!vFrag || !jFrag) continue;

      const vCdr3 = vSeq.substring(cdr3Begin - vFrag.range.from, vEnd - vFrag.range.from);
      const jCdr3 = jSeq.substring(jBegin - jFrag.range.from, fr4Begin - jFrag.range.from);

      if (vCdr3.length > 0 && jCdr3.length > 0) {
        cdr3Parts.push(`>${prefix}_CDR3\n${vCdr3}${jCdr3}`);
      }
    }
  }

  return cdr3Parts.length > 0 ? cdr3Parts.join('\n') : undefined;
}
