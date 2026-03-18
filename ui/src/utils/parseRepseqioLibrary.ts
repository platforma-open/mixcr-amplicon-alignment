import type {
  LibraryEntryDefinition,
  VAnchorPoints,
  JAnchorPoints,
} from "@platforma-open/milaboratories.mixcr-amplicon-alignment.model";

interface RepseqioGene {
  baseSequence: string;
  name: string;
  geneType: string;
  anchorPoints: Record<string, number>;
}

interface RepseqioFragment {
  uri: string;
  range: { from: number; to: number };
  sequence: string;
}

interface RepseqioEntry {
  genes: RepseqioGene[];
  sequenceFragments: RepseqioFragment[];
}

/**
 * Parse a repseqio compiled library JSON into LibraryEntryDefinition[].
 *
 * Matches V/J gene pairs by name prefix (e.g. "ref_Vgene" + "ref_Jgene").
 * Extracts sequences from sequenceFragments and anchor points from gene anchorPoints.
 */
export function parseRepseqioLibrary(jsonContent: string): LibraryEntryDefinition[] {
  let entries: RepseqioEntry[];
  try {
    entries = JSON.parse(jsonContent);
  } catch {
    return [];
  }

  if (!Array.isArray(entries)) return [];

  const result: LibraryEntryDefinition[] = [];

  for (const entry of entries) {
    const fragments = entry.sequenceFragments ?? [];

    const resolveSequence = (gene: RepseqioGene): string | undefined => {
      const frag = fragments.find((f) => f.uri === gene.baseSequence);
      return frag?.sequence;
    };

    // Index V and J genes by name prefix
    const vGenes = new Map<string, RepseqioGene>();
    const jGenes = new Map<string, RepseqioGene>();

    for (const gene of entry.genes) {
      if (gene.geneType === "V" && gene.name.endsWith("_Vgene")) {
        const prefix = gene.name.slice(0, -"_Vgene".length);
        vGenes.set(prefix, gene);
      } else if (gene.geneType === "J" && gene.name.endsWith("_Jgene")) {
        const prefix = gene.name.slice(0, -"_Jgene".length);
        jGenes.set(prefix, gene);
      }
    }

    for (const [prefix, vGene] of vGenes) {
      const jGene = jGenes.get(prefix);
      if (!jGene) continue;

      const vSeq = resolveSequence(vGene);
      const jSeq = resolveSequence(jGene);
      if (!vSeq || !jSeq) continue;

      const ap = vGene.anchorPoints;
      const jap = jGene.anchorPoints;

      const vAnchorPoints: VAnchorPoints = {
        fr1Begin: ap.FR1Begin ?? 0,
        cdr1Begin: ap.CDR1Begin ?? 0,
        fr2Begin: ap.FR2Begin ?? 0,
        cdr2Begin: ap.CDR2Begin ?? 0,
        fr3Begin: ap.FR3Begin ?? 0,
        cdr3Begin: ap.CDR3Begin ?? 0,
        vEnd: ap.VEnd ?? 0,
      };

      const jAnchorPoints: JAnchorPoints = {
        jBegin: jap.JBegin ?? 0,
        fr4Begin: jap.FR4Begin ?? 0,
        fr4End: jap.FR4End ?? 0,
      };

      result.push({
        name: prefix,
        vSequence: vSeq,
        jSequence: jSeq,
        vAnchorPoints,
        jAnchorPoints,
      });
    }
  }

  return result;
}
