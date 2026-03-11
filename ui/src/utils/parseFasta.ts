export interface FastaParseResult {
  isValid: boolean;
  error?: string;
  vGenes?: string;
  jGenes?: string;
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
export function parseFastaRecords(content: string): FastaRecord[] {
  const lines = content.trim().split('\n');
  const records: FastaRecord[] = [];
  let currentHeader: string | null = null;
  let currentSequence = '';

  // Handle case where content might be a single sequence without a header
  if (!content.trim().startsWith('>')) {
    const sequence = lines
      .map((l) => l.trim())
      .join('')
      .toUpperCase()
      .replace(/\s/g, '');
    if (sequence) {
      return [{ header: '', sequence }];
    }
    return [];
  }

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    if (trimmedLine.startsWith('>')) {
      // Save previous record if exists
      if (currentHeader !== null && currentSequence) {
        records.push({
          header: currentHeader,
          sequence: currentSequence.toUpperCase().replace(/\s/g, ''),
        });
      }
      // Start new record
      currentHeader = trimmedLine.substring(1).trim(); // Remove '>' and trim
      currentSequence = '';
    } else if (currentHeader !== null) {
      // Sequence line
      currentSequence += trimmedLine;
    }
  }

  // Add the last record
  if (currentHeader !== null && currentSequence) {
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
 * @returns FastaParseResult with validation details
 */
export function parseFasta(content: string, selectedHeaders?: string[]): FastaParseResult {
  // Check if content is empty
  if (!content.trim()) {
    return {
      isValid: false,
      error: 'FASTA content is empty',
    };
  }

  const lines = content.trim().split('\n');
  if (lines.some((line) => line.trim() === '>')) {
    const error
      = 'Headers cannot be empty. Please provide a name after ">" (e.g., ">ref_name").';
    return { isValid: false, error };
  }
  if (lines[lines.length - 1]?.trim().startsWith('>')) {
    const error
      = 'FASTA content ends with a header but no sequence. Each header must be followed by sequence data.';
    return { isValid: false, error };
  }

  // Parse FASTA content
  let records = parseFastaRecords(content);

  // Filter to selected records if specified
  if (selectedHeaders && selectedHeaders.length > 0) {
    records = records.filter((r) => selectedHeaders.includes(r.header));
  }

  if (records.length === 0) {
    return {
      isValid: false,
      error:
        'No valid FASTA records found. Please ensure the content is in FASTA format or a single raw sequence.',
    };
  }

  // Check for mix of headered and non-headered sequences
  if (records.length > 1 && records.some((r) => !r.header)) {
    const error
      = 'Multiple sequences detected, but some are missing headers. Please provide headers for all sequences.';
    return { isValid: false, error };
  }

  const vGeneParts: string[] = [];
  const jGeneParts: string[] = [];
  const headers: string[] = [];

  // Validate each record
  for (const [i, record] of records.entries()) {
    const { header, sequence } = record;

    // Validate header
    if (records.length > 1 && (!header || header.trim().length === 0)) {
      const error = `A sequence record is missing a header. All sequences must have a header in a multi-sequence FASTA.`;
      return { isValid: false, error };
    }

    const recordIdentifier = header ? `Record "${header}"` : `Record ${i + 1}`;
    const headerRoot = header ? header.split('|')[0]?.trim() : '';

    // Clean the sequence (remove whitespace, convert to uppercase, and normalize IUPAC wildcards to N)
    const cleanSequence = sequence
      .toUpperCase()
      .replace(/\s/g, '')
      .replace(/[RYWSKMBDHV]/g, 'N'); // Replace all IUPAC wildcards with N

    // Validate sequence contains only valid DNA characters (excluding wildcards which we already replaced)
    const validDNACars = /^[ACGTN]+$/;
    if (!cleanSequence || !validDNACars.test(cleanSequence)) {
      const invalidChars = cleanSequence.match(/[^ACGTN]/g);
      const error = `${recordIdentifier}: Invalid DNA characters: ${invalidChars?.join(
        ', ',
      )}`;
      return { isValid: false, error };
    }

    // Check minimum length
    if (cleanSequence.length < 250) {
      const error = `${recordIdentifier}: Sequence too short (${cleanSequence.length} nucleotides, minimum 250 required)`;
      return { isValid: false, error };
    }

    // repseqio fromFasta rejects sequences with wildcards, so replace N→A for V/J genes.
    // CDR3 sequences keep N's for the distance calculation tool.
    const sequenceWithoutN = cleanSequence.replace(/N/g, 'A');
    const referenceSequence = cleanSequence;

    // Translate DNA to protein for pattern validation using the adjusted reference sequence
    const translatedSequence = translateDNAToProtein(referenceSequence);

    if (translatedSequence.length === 0) {
      const error = `${recordIdentifier}: Translation resulted in empty protein sequence (possibly due to early stop codon)`;
      return { isValid: false, error };
    }

    // Apply the regex validation and capture CDR3 (up to the conserved W/F/L/Y/I)
    const validationRegex
      = /C([ACDEFGHIKLMNPQRSTVWYX]{4,50}[FWYLIX])[ACDEFGHIKLMNPQRSTVWYX]{0,5}G[ACDEFGHIKLMNPQRSTVWYX]G/;

    // Only search from position 80 onwards (240 nucleotides)
    const searchStartPosition = 80; // 240 nucleotides / 3 = 80 amino acids
    const sequenceToSearch = translatedSequence.substring(searchStartPosition);

    const match = validationRegex.exec(sequenceToSearch);
    if (!match) {
      const error = `${recordIdentifier}: Translated sequence does not contain CDR3 after position ${searchStartPosition}`;
      return { isValid: false, error };
    }

    // Extract the two sequences with headers
    const patternStartInFullSequence = searchStartPosition + match.index;

    // Find CDR3 boundaries: from first C to the conserved W/F/L/Y/I captured by regex
    const firstCysteinePosition = patternStartInFullSequence; // First C in pattern
    const cdr3AaLength = match[1].length + 1; // include leading C
    const cdr3EndInFullSequence = patternStartInFullSequence + cdr3AaLength;

    // Calculate CDR3 nucleotide boundaries
    const cdr3StartNucleotides = firstCysteinePosition * 3; // Start of CDR3 (first C)
    const cdr3EndNucleotides = cdr3EndInFullSequence * 3; // End of CDR3 (last W/F/L/Y/I)
    const cdr3LengthNucleotides = cdr3EndNucleotides - cdr3StartNucleotides;
    const cdr3HalfLengthNucleotides = Math.floor(cdr3LengthNucleotides / 2);

    // V gene: from beginning to first cysteine + half of CDR3
    // Use sequenceWithoutN (N→A) since repseqio fromFasta rejects wildcard nucleotides
    const vGeneEndNucleotides = cdr3StartNucleotides + cdr3HalfLengthNucleotides;
    const vGeneSequence = sequenceWithoutN.substring(0, vGeneEndNucleotides);
    const vGeneHeader = headerRoot ? `${headerRoot}_Vgene` : 'ref_Vgene';
    const vGene = `>${vGeneHeader}\n${vGeneSequence}`;

    // J gene: from second half of CDR3 to sequence end
    // Use sequenceWithoutN (N→A) since repseqio fromFasta rejects wildcard nucleotides
    const jGeneStartNucleotides = cdr3StartNucleotides + cdr3HalfLengthNucleotides;
    const jGeneSequence = sequenceWithoutN.substring(jGeneStartNucleotides);
    const jGeneHeader = headerRoot ? `${headerRoot}_Jgene` : 'ref_Jgene';
    const jGene = `>${jGeneHeader}\n${jGeneSequence}`;

    vGeneParts.push(vGene);
    jGeneParts.push(jGene);
    if (header) headers.push(header);
  }

  // Create single FASTA strings for all V and J genes
  const vGenes = vGeneParts.join('\n');
  const jGenes = jGeneParts.join('\n');

  return {
    isValid: true,
    vGenes,
    jGenes,
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
