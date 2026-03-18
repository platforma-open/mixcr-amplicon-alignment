import type {
  LibraryEntryDefinition,
  VAnchorPoints,
  JAnchorPoints,
} from "@platforma-open/milaboratories.mixcr-amplicon-alignment.model";

/**
 * Extract CDR3 sequences from library entry definitions.
 * For each entry: CDR3 = vSequence[cdr3Begin:vEnd] + jSequence[jBegin:fr4Begin]
 */
export function extractCdr3FromDefinitions(entries: LibraryEntryDefinition[]): string | undefined {
  const parts: string[] = [];

  for (const entry of entries) {
    if (!entry.vSequence || !entry.jSequence) continue;

    const vCdr3 = entry.vSequence.substring(
      entry.vAnchorPoints.cdr3Begin,
      entry.vAnchorPoints.vEnd,
    );
    const jCdr3 = entry.jSequence.substring(
      entry.jAnchorPoints.jBegin,
      entry.jAnchorPoints.fr4Begin,
    );

    if (vCdr3.length > 0 && jCdr3.length > 0) {
      parts.push(`>${entry.name}_CDR3\n${vCdr3}${jCdr3}`);
    }
  }

  return parts.length > 0 ? parts.join("\n") : undefined;
}

/** V gene region sequences decomposed from anchor points */
export interface VRegions {
  fr1: string;
  cdr1: string;
  fr2: string;
  cdr2: string;
  fr3: string;
  vPartCdr3: string;
}

/** J gene region sequences decomposed from anchor points */
export interface JRegions {
  jPartCdr3: string;
  fr4: string;
}

/** Decompose V gene sequence into regions using anchor points */
export function getVRegions(entry: LibraryEntryDefinition): VRegions {
  const s = entry.vSequence;
  const a = entry.vAnchorPoints;
  return {
    fr1: s.substring(a.fr1Begin, a.cdr1Begin),
    cdr1: s.substring(a.cdr1Begin, a.fr2Begin),
    fr2: s.substring(a.fr2Begin, a.cdr2Begin),
    cdr2: s.substring(a.cdr2Begin, a.fr3Begin),
    fr3: s.substring(a.fr3Begin, a.cdr3Begin),
    vPartCdr3: s.substring(a.cdr3Begin, a.vEnd),
  };
}

/** Decompose J gene sequence into regions using anchor points */
export function getJRegions(entry: LibraryEntryDefinition): JRegions {
  const s = entry.jSequence;
  const a = entry.jAnchorPoints;
  return {
    jPartCdr3: s.substring(a.jBegin, a.fr4Begin),
    fr4: s.substring(a.fr4Begin, a.fr4End),
  };
}

/** Recompose V gene regions into full sequence + anchor points */
export function recomposeVGene(regions: VRegions): {
  vSequence: string;
  vAnchorPoints: VAnchorPoints;
} {
  const vSequence =
    regions.fr1 + regions.cdr1 + regions.fr2 + regions.cdr2 + regions.fr3 + regions.vPartCdr3;
  let pos = 0;
  const fr1Begin = pos;
  pos += regions.fr1.length;
  const cdr1Begin = pos;
  pos += regions.cdr1.length;
  const fr2Begin = pos;
  pos += regions.fr2.length;
  const cdr2Begin = pos;
  pos += regions.cdr2.length;
  const fr3Begin = pos;
  pos += regions.fr3.length;
  const cdr3Begin = pos;
  pos += regions.vPartCdr3.length;
  const vEnd = pos;
  return {
    vSequence,
    vAnchorPoints: { fr1Begin, cdr1Begin, fr2Begin, cdr2Begin, fr3Begin, cdr3Begin, vEnd },
  };
}

/** Recompose J gene regions into full sequence + anchor points */
export function recomposeJGene(regions: JRegions): {
  jSequence: string;
  jAnchorPoints: JAnchorPoints;
} {
  const jSequence = regions.jPartCdr3 + regions.fr4;
  const jBegin = 0;
  const fr4Begin = regions.jPartCdr3.length;
  const fr4End = fr4Begin + regions.fr4.length;
  return {
    jSequence,
    jAnchorPoints: { jBegin, fr4Begin, fr4End },
  };
}

const codonTable: Record<string, string> = {
  TTT: "F",
  TTC: "F",
  TTA: "L",
  TTG: "L",
  TCT: "S",
  TCC: "S",
  TCA: "S",
  TCG: "S",
  TAT: "Y",
  TAC: "Y",
  TAA: "*",
  TAG: "*",
  TGT: "C",
  TGC: "C",
  TGA: "*",
  TGG: "W",
  CTT: "L",
  CTC: "L",
  CTA: "L",
  CTG: "L",
  CCT: "P",
  CCC: "P",
  CCA: "P",
  CCG: "P",
  CAT: "H",
  CAC: "H",
  CAA: "Q",
  CAG: "Q",
  CGT: "R",
  CGC: "R",
  CGA: "R",
  CGG: "R",
  ATT: "I",
  ATC: "I",
  ATA: "I",
  ATG: "M",
  ACT: "T",
  ACC: "T",
  ACA: "T",
  ACG: "T",
  AAT: "N",
  AAC: "N",
  AAA: "K",
  AAG: "K",
  AGT: "S",
  AGC: "S",
  AGA: "R",
  AGG: "R",
  GTT: "V",
  GTC: "V",
  GTA: "V",
  GTG: "V",
  GCT: "A",
  GCC: "A",
  GCA: "A",
  GCG: "A",
  GAT: "D",
  GAC: "D",
  GAA: "E",
  GAG: "E",
  GGT: "G",
  GGC: "G",
  GGA: "G",
  GGG: "G",
};

/** Translate a nucleotide sequence to amino acids */
export function translateDNA(nt: string): string {
  const seq = nt.toUpperCase().replace(/\s/g, "");
  let result = "";
  for (let i = 0; i + 2 < seq.length; i += 3) {
    const codon = seq.substring(i, i + 3);
    result += codonTable[codon] ?? "X";
  }
  return result;
}
