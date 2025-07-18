export interface FastaValidationResult {
  isValid: boolean;
  error?: string;
  errors?: string[];
  warnings?: string[];
  vGenes?: string; // Single FASTA string with all V genes
  jGenes?: string; // Single FASTA string with all J genes
  headers?: string[];
  records?: FastaRecord[];
}

export interface FastaRecord {
  header: string;
  sequence: string;
}

/**
 * Parses FASTA content and returns an array of records
 * @param content - The FASTA content to parse
 * @returns Array of FASTA records
 */
export function parseFasta(content: string): FastaRecord[] {
  const lines = content.trim().split('\n');
  const records: FastaRecord[] = [];
  let currentHeader = '';
  let currentSequence = '';

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    if (trimmedLine.startsWith('>')) {
      // Save previous record if exists
      if (currentHeader && currentSequence) {
        records.push({
          header: currentHeader,
          sequence: currentSequence.toUpperCase().replace(/\s/g, ''),
        });
      }
      // Start new record
      currentHeader = trimmedLine.substring(1); // Remove '>'
      currentSequence = '';
    } else {
      // Sequence line
      currentSequence += trimmedLine;
    }
  }

  // Add the last record
  if (currentHeader && currentSequence) {
    records.push({
      header: currentHeader,
      sequence: currentSequence.toUpperCase().replace(/\s/g, ''),
    });
  }

  return records;
}

/**
 * Validates FASTA content and extracts V and J gene sequences
 * @param content - The FASTA content to validate
 * @returns FastaValidationResult with validation details
 */
export function validateFastaSequence(content: string): FastaValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check if content is empty
  if (!content.trim()) {
    return {
      isValid: false,
      error: 'FASTA content is empty',
      errors: ['FASTA content is empty'],
    };
  }

  // Parse FASTA content
  const records = parseFasta(content);

  if (records.length === 0) {
    return {
      isValid: false,
      error: 'No valid FASTA records found',
      errors: ['No valid FASTA records found'],
    };
  }

  const vGeneParts: string[] = [];
  const jGeneParts: string[] = [];
  const headers: string[] = [];

  // Validate each record
  for (const record of records) {
    const { header, sequence } = record;

    // Validate header
    if (!header || header.trim().length === 0) {
      errors.push(`Record ${headers.length + errors.length + 1}: Empty header`);
      continue;
    }

    // Clean the sequence (remove whitespace, convert to uppercase, and replace IUPAC wildcards with A)
    const cleanSequence = sequence
      .toUpperCase()
      .replace(/\s/g, '')
      .replace(/[NRYWSKMBDHV]/g, 'A'); // Replace all IUPAC wildcards with A

    // Validate sequence contains only valid DNA characters (excluding wildcards which we already replaced)
    const validDNACars = /^[ACGT]+$/;
    if (!validDNACars.test(cleanSequence)) {
      const invalidChars = cleanSequence.match(/[^ACGT]/g);
      errors.push(`Record "${header}": Invalid DNA characters: ${invalidChars?.join(', ')}`);
      continue;
    }

    // Check minimum length
    if (cleanSequence.length < 250) {
      errors.push(`Record "${header}": Sequence too short (${cleanSequence.length} nucleotides, minimum 250 required)`);
      continue;
    }

    // Check if sequence length is a multiple of 3
    if (cleanSequence.length % 3 !== 0) {
      warnings.push(`Record "${header}": Sequence length is not a multiple of 3 - translation may be incomplete`);
    }

    // Translate DNA to protein for pattern validation
    const translatedSequence = translateDNAToProtein(cleanSequence);

    if (translatedSequence.length === 0) {
      errors.push(`Record "${header}": Translation resulted in empty protein sequence (possibly due to early stop codon)`);
      continue;
    }

    // Check if translation contains unknown amino acids
    if (translatedSequence.includes('X')) {
      warnings.push(`Record "${header}": Translation contains unknown amino acids (X) due to invalid codons`);
    }

    // Apply the regex validation: C[ACDEFGHIKLMNPQRSTVWY]+(?:[GAST])?[WFL]
    const validationRegex
      = /C[ACDEFGHIKLMNPQRSTVWY]{4,50}[FWYLI][ACDEFGHIKLMNPQRSTVWY]{0,5}G[ACDEFGHIKLMNPQRSTVWY]G/;

    // Only search from position 80 onwards (240 nucleotides)
    const searchStartPosition = 80; // 240 nucleotides / 3 = 80 amino acids
    const sequenceToSearch = translatedSequence.substring(searchStartPosition);

    const match = validationRegex.exec(sequenceToSearch);
    if (!match) {
      errors.push(`Record "${header}": Translated sequence does not contain CDR3 after position ${searchStartPosition}`);
      continue;
    }

    // Extract the two sequences with headers
    const patternStartInFullSequence = searchStartPosition + match.index;
    const patternEndInFullSequence = patternStartInFullSequence + match[0].length;

    // First sequence: from beginning to first cysteine in pattern + 3 nucleotides
    const firstCysteinePosition = patternStartInFullSequence; // First C in pattern
    const vGeneEndNucleotides = (firstCysteinePosition + 3) * 3; // +2 for the cysteine, *3 for nucleotides
    const vGeneSequence = cleanSequence.substring(0, vGeneEndNucleotides);
    const vGene = `>${header}_Vgene\n${vGeneSequence}`;

    // Second sequence: from 6 nucleotides before pattern end to sequence end
    const patternEndNucleotides = patternEndInFullSequence * 3;
    const jGeneStartNucleotides = patternEndNucleotides - 21; // 6 nucleotides before pattern end
    const jGeneSequence = cleanSequence.substring(jGeneStartNucleotides);
    const jGene = `>${header}_Jgene\n${jGeneSequence}`;

    vGeneParts.push(vGene);
    jGeneParts.push(jGene);
    headers.push(header);
  }

  // If any records are invalid, return error
  if (errors.length > 0) {
    return {
      isValid: false,
      error: 'Some records are invalid',
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
      records,
    };
  }

  // Create single FASTA strings for all V and J genes
  const vGenes = vGeneParts.join('\n');
  const jGenes = jGeneParts.join('\n');

  return {
    isValid: true,
    vGenes,
    jGenes,
    headers,
    warnings: warnings.length > 0 ? warnings : undefined,
    records,
  };
}

// DNA to protein translation table
const codonTable: Record<string, string> = {
  TTT: 'F',
  TTC: 'F',
  TTA: 'L',
  TTG: 'L',
  TCT: 'S',
  TCC: 'S',
  TCA: 'S',
  TCG: 'S',
  TAT: 'Y',
  TAC: 'Y',
  TAA: '*',
  TAG: '*',
  TGT: 'C',
  TGC: 'C',
  TGA: '*',
  TGG: 'W',
  CTT: 'L',
  CTC: 'L',
  CTA: 'L',
  CTG: 'L',
  CCT: 'P',
  CCC: 'P',
  CCA: 'P',
  CCG: 'P',
  CAT: 'H',
  CAC: 'H',
  CAA: 'Q',
  CAG: 'Q',
  CGT: 'R',
  CGC: 'R',
  CGA: 'R',
  CGG: 'R',
  ATT: 'I',
  ATC: 'I',
  ATA: 'I',
  ATG: 'M',
  ACT: 'T',
  ACC: 'T',
  ACA: 'T',
  ACG: 'T',
  AAT: 'N',
  AAC: 'N',
  AAA: 'K',
  AAG: 'K',
  AGT: 'S',
  AGC: 'S',
  AGA: 'R',
  AGG: 'R',
  GTT: 'V',
  GTC: 'V',
  GTA: 'V',
  GTG: 'V',
  GCT: 'A',
  GCC: 'A',
  GCA: 'A',
  GCG: 'A',
  GAT: 'D',
  GAC: 'D',
  GAA: 'E',
  GAG: 'E',
  GGT: 'G',
  GGC: 'G',
  GGA: 'G',
  GGG: 'G',
};

/**
 * Translates DNA sequence to protein sequence
 * @param dnaSequence - The DNA sequence to translate
 * @returns The translated protein sequence
 */
function translateDNAToProtein(dnaSequence: string): string {
  const cleanSequence = dnaSequence.toUpperCase().replace(/\s/g, '');
  let proteinSequence = '';

  // Translate in reading frame 1 (starting from first nucleotide)
  for (let i = 0; i <= cleanSequence.length - 3; i += 3) {
    const codon = cleanSequence.substring(i, i + 3);
    const aminoAcid = codonTable[codon];

    if (aminoAcid) {
      if (aminoAcid === '*') {
        // Stop codon - end translation
        break;
      }
      proteinSequence += aminoAcid;
    } else {
      // Invalid codon - add X for unknown
      proteinSequence += 'X';
    }
  }

  return proteinSequence;
}
