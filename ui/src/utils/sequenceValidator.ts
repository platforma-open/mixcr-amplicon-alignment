export interface SequenceValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
  translatedSequence?: string;
  vGene?: string;
  jGene?: string;
}

// DNA to protein translation table
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

/**
 * Translates DNA sequence to protein sequence
 * @param dnaSequence - The DNA sequence to translate
 * @returns The translated protein sequence
 */
function translateDNAToProtein(dnaSequence: string): string {
  const cleanSequence = dnaSequence.toUpperCase().replace(/\s/g, "");
  let proteinSequence = "";

  // Translate in reading frame 1 (starting from first nucleotide)
  for (let i = 0; i <= cleanSequence.length - 3; i += 3) {
    const codon = cleanSequence.substring(i, i + 3);
    const aminoAcid = codonTable[codon];

    if (aminoAcid) {
      if (aminoAcid === "*") {
        // Stop codon - end translation
        break;
      }
      proteinSequence += aminoAcid;
    } else {
      // Invalid codon - add X for unknown
      proteinSequence += "X";
    }
  }

  return proteinSequence;
}

/**
 * Validates library sequence by translating DNA to protein and matching regex
 * @param sequence - The DNA sequence to validate
 * @returns SequenceValidationResult with validation details
 */
export function validateLibrarySequence(
  sequence: string
): SequenceValidationResult {
  const warnings: string[] = [];

  // Check if sequence is empty
  if (!sequence.trim()) {
    return {
      isValid: false,
      error: "Sequence is empty",
    };
  }

  // Clean the sequence (remove whitespace and convert to uppercase)
  const cleanSequence = sequence.toUpperCase().replace(/\s/g, "");

  // Check if sequence contains only valid DNA characters
  const validDNACars = /^[ACGTN]+$/;
  if (!validDNACars.test(cleanSequence)) {
    const invalidChars = cleanSequence.match(/[^ACGTN]/g);
    return {
      isValid: false,
      error: `Invalid DNA characters found: ${invalidChars?.join(", ")}`,
    };
  }

  // Check if sequence length is a multiple of 3
  if (cleanSequence.length % 3 !== 0) {
    warnings.push(
      "Sequence length is not a multiple of 3 - translation may be incomplete"
    );
  }

  // Check minimum length
  if (cleanSequence.length < 9) {
    return {
      isValid: false,
      error: "Sequence is too short (minimum 9 nucleotides required)",
    };
  }

  // Translate DNA to protein
  const translatedSequence = translateDNAToProtein(cleanSequence);

  if (translatedSequence.length === 0) {
    return {
      isValid: false,
      error:
        "Translation resulted in empty protein sequence (possibly due to early stop codon)",
    };
  }

  // Check if translation contains unknown amino acids
  if (translatedSequence.includes("X")) {
    warnings.push(
      "Translation contains unknown amino acids (X) due to invalid codons"
    );
  }

  // Apply the regex validation: C[ACDEFGHIKLMNPQRSTVWY]+(?:[GAST])?[WFL]
  const validationRegex =
    /C[ACDEFGHIKLMNPQRSTVWY]{4,50}[FWYLI][ACDEFGHIKLMNPQRSTVWY]{0,5}G[ACDEFGHIKLMNPQRSTVWY]G/;

  // Only search from position 80 onwards (240 nucleotides)
  const searchStartPosition = 80; // 240 nucleotides / 3 = 80 amino acids
  const sequenceToSearch = translatedSequence.substring(searchStartPosition);

  const match = validationRegex.exec(sequenceToSearch);
  if (!match) {
    return {
      isValid: false,
      error: `Translated sequence does not contain required pattern after position ${searchStartPosition}. Expected pattern: C[ACDEFGHIKLMNPQRSTVWY]+(?:[GAST])?[WFL]. Got: ${translatedSequence}`,
      translatedSequence,
    };
  }

  // Extract the two sequences
  const patternStartInFullSequence = searchStartPosition + match.index;
  const patternEndInFullSequence = patternStartInFullSequence + match[0].length;

  // First sequence: from beginning to first cysteine in pattern + 3 nucleotides
  const firstCysteinePosition = patternStartInFullSequence; // First C in pattern
  const vGeneEndNucleotides = (firstCysteinePosition + 3) * 3; // +2 for the cysteine, *3 for nucleotides
  const vGeneSequence = cleanSequence.substring(0, vGeneEndNucleotides);
  const vGene = `>Vgene\n${vGeneSequence}`;

  // Second sequence: from 6 nucleotides before pattern end to sequence end
  const patternEndNucleotides = patternEndInFullSequence * 3;
  const jGeneStartNucleotides = patternEndNucleotides - 21; // 6 nucleotides before pattern end
  const jGeneSequence = cleanSequence.substring(jGeneStartNucleotides);
  const jGene = `>JGene\n${jGeneSequence}`;

  return {
    isValid: true,
    translatedSequence,
    vGene,
    jGene,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
