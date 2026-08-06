import { describe, expect, it } from "vitest";
import { parseFasta, parseFastaRecords } from "./parseFasta";

/**
 * The S1-F4 parental anti-CD98hc VH domain, 375 nt. A real reference: full-length,
 * a multiple of three, and its conserved cysteine sits past the CDR3 search offset,
 * so it reaches the gene-derivation code rather than failing validation first.
 */
const VH_375NT = [
  "CAGGTGCAGCTGGTGCAGAGCGGGGCAGAGGTGAAGAAGCCCGGAGCCAGCGTGAAAGTG",
  "AGCTGCAAGGCCAGCGGCTACACCTTCACGAGCTATTACATGCACTGGGTGAGGCAGGCA",
  "CCCGGTCAGGGCCTGGAGTGGATGGGCATCATCAACCCCTCTGGCGGCAGCACCAGTTAC",
  "GCCCAGAAGTTCCAGGGTAGGGTGACCATGACCAGGGACACCAGTACCTCCACCGTGTAC",
  "ATGGAGCTGAGCAGCCTGAGGAGCGAGGACACCGCCGTGTATTACTGCGCCAGGGGCTAC",
  "TACGACATTCTCACTGGTTCTCGTCCCATCTTCTTCGACATTTGGGGGCAGGGCACTATG",
  "GTGACCGTGAGCTCT",
].join("\n");

/**
 * The synthetic nanobody parental clone from `2026-07-synthetic-nanobody-abaumannii`,
 * 303 nt. This is the amplified region, so it begins mid-FR1 at `…RLSCAAS` rather than
 * at the domain N-terminus: 101 aa with the conserved CDR3 cysteine at residue 78, ahead
 * of the search offset. `N` marks a randomized CDR position (CDR1/CDR2/CDR3 = 7/7/9 aa).
 */
const VHH_303NT = [
  "CGTTTGTCTTGTGCTGCGTCCGGCNNNNNNNNNNNNNNNNNNNNNATGGGGTGGTTTCGC",
  "CAGGCACCTGGCAAAGAACGTGAATTTGTTGCAGCAATTAGTNNNNNNNNNNNNNNNNNN",
  "NNNTACTACGCAGATTCCGTTAAGGGACGCTTCACAATTTCGCGCGACAATGCAAAAAAT",
  "ACCGTGTATTTACAAATGAATTCGTTGAAGCCGGAAGACACTGCGACTTATTATTGTGCG",
  "NNNNNNNNNNNNNNNNNNNNNNNNNNNTATTGGGGACAAGGCACACAAGTCACGGTCTCC",
  "GTG",
].join("\n");

/**
 * `KU641040.1` from the macaque anti-SIV gp140 panel, 738 nt. A single-chain Fv, so one
 * record carries two variable domains and therefore two CDR3s — the VL's at residue 88
 * and the VH's at 212. The block resolves this to the first CDR3 past the offset.
 */
const SCFV_738NT = [
  "ATGCTGACTCAGCCCCACTCTGTGTCGGGGTCTCCGGGGCAGACGGTCACCATCTCCTGC",
  "ACCCGCAGCAGTGGCTACATTGGCAGCAACTCTGTGTACTGGTACCAGCAGCGGCCGGGC",
  "AGCGCCCCCACCACTGTGATTTACAAAGATAATCAAAGACCCTCTGGGATCCCTGATCGG",
  "TTCTCTGGCTCCATCGACAGCTCCTCCAACTCTGCCTCCCTCACCATCTCTGGACTGAAG",
  "TCTGAGGACGAGGCTGACTACTACTGTCAGTCTTATGACAGCACTTATGATGTGTTTTTC",
  "GGAGGAGGCACCAAGCTGACCGTCCTAGGCGGTGGTTCCTCTAGATCTTCCGAGGTGCAG",
  "CTGGTGCAGTCTGGGACTGAGGTGAGGAAGCCTGGGGCCTCAGTGAAGGTTTCCTGCCAG",
  "GCTTCTGGCATCAGCTTCGACAGATATGCTCTCACCTGGGTGCGACAGGTCCCTGGACAA",
  "GGGCTTGAGTGGATGGGATCGATCATCCCTCTTGCTAGCATGACAAAGTACGCAGAGAAG",
  "TTCCAGGGCAGAGTCACGATAACCGCGGATACGTCCAGAGGGACAGCCTACATGGAGCTG",
  "AGTAGCCTGACATCTGAGGACACGGCCGTTTATTATTGTGCGAGACCCGGGGACGACAGT",
  "GGGGCCTTTGACCTCTGGGGCCAGGGAGCCCTGGTCACCGTCTCCTCAGCCTCCACCAAG",
  "GGCCCATCGGTCACTAGT",
].join("\n");

/** The header of that reference as the studies library actually ships it. */
const DESCRIPTIVE_HEADER =
  "S1-F4_VH parental anti-CD98hc heavy variable domain, nucleotide (recovered by " +
  "base-consensus from the input-pool reads SRR37934230; framework matches the " +
  "yeast-display construct and translates to the PDB 7DF1 VH); WT HCDR3 " +
  "GYYDILTGSRPIFFDI, 10 randomized positions YYDILGSRPI";

function fasta(...records: [header: string, sequence: string][]): string {
  return records.map(([h, s]) => `>${h}\n${s}`).join("\n");
}

/** First line of a single-record FASTA string, without the leading ">". */
function geneName(fastaString: string | undefined): string {
  return (fastaString ?? "").split("\n")[0]?.replace(/^>/, "") ?? "";
}

/** Sequence body of a single-record V or J FASTA string, without the header line. */
function geneSequence(fastaString: string | undefined): string {
  return (fastaString ?? "").split("\n").slice(1).join("");
}

function geneNames(fastaString: string | undefined): string[] {
  return (fastaString ?? "")
    .split("\n")
    .filter((l) => l.startsWith(">"))
    .map((l) => l.slice(1));
}

describe("parseFasta gene naming", () => {
  it("strips a descriptive header down to its identifier", () => {
    const result = parseFasta(fasta([DESCRIPTIVE_HEADER, VH_375NT]));

    expect(result.isValid).toBe(true);
    expect(geneName(result.vGenes)).toBe("S1-F4_VH_Vgene");
    expect(geneName(result.jGenes)).toBe("S1-F4_VH_Jgene");
  });

  // The invariant behind the bug: repseqio addresses a gene as the fragment of a
  // `file://<file>#<geneName>` URI, so an illegal fragment character fails the whole
  // library build — far from here, and only after validation has reported success.
  //
  // Asserted as a character-set constraint rather than by constructing a URL: repseqio
  // parses with Java's `java.net.URI`, which follows RFC 2396 and throws on an illegal
  // fragment, whereas JS `new URL()` is WHATWG and percent-encodes instead of throwing —
  // it accepts every header below, including the 275-character one that caused the bug.
  it("derives gene names that are legal URI fragments", () => {
    const headers = [
      DESCRIPTIVE_HEADER,
      "plain_name",
      "with.dots-and_underscores",
      "trailing spaces and (parens), semicolons; commas",
    ];

    for (const header of headers) {
      const result = parseFasta(fasta([header, VH_375NT]));
      expect(result.isValid).toBe(true);

      for (const name of [geneName(result.vGenes), geneName(result.jGenes)]) {
        expect(name).not.toMatch(/[^A-Za-z0-9_.-]/);
      }
    }
  });

  it("keeps a header that is already a single token", () => {
    const result = parseFasta(fasta(["CR9114_HC_WT", VH_375NT]));

    expect(geneName(result.vGenes)).toBe("CR9114_HC_WT_Vgene");
  });

  it("takes the field before a pipe, then its first word", () => {
    const result = parseFasta(
      fasta(["emibetuzumab_VH_WT_nt | parental VH nucleotide (construct)", VH_375NT]),
    );

    expect(geneName(result.vGenes)).toBe("emibetuzumab_VH_WT_nt_Vgene");
  });

  // Truncation alone would collapse these into one gene name, trading a loud failure
  // for a silent wrong answer.
  it("disambiguates headers that reduce to the same token", () => {
    const result = parseFasta(
      fasta(["shared_prefix first variant", VH_375NT], ["shared_prefix second variant", VH_375NT]),
    );

    expect(result.isValid).toBe(true);
    expect(geneNames(result.vGenes)).toEqual(["shared_prefix_Vgene", "shared_prefix_2_Vgene"]);
    expect(geneNames(result.jGenes)).toEqual(["shared_prefix_Jgene", "shared_prefix_2_Jgene"]);
  });

  it("falls back to a default name when nothing usable survives", () => {
    const result = parseFasta(fasta(["((( ;;; )))", VH_375NT]));

    expect(result.isValid).toBe(true);
    expect(geneName(result.vGenes)).toBe("ref_Vgene");
    expect(geneName(result.jGenes)).toBe("ref_Jgene");
  });

  // The fallback has to share the counter too. A multi-record FASTA only requires
  // headers to be non-empty, not usable, so several records can sanitize away — and
  // two records both named `ref_Vgene` would let repseqio index one over the other.
  it("disambiguates records whose headers all sanitize away", () => {
    const result = parseFasta(fasta(["(((", VH_375NT], [";;;", VH_375NT], ["!!!", VH_375NT]));

    expect(result.isValid).toBe(true);
    expect(geneNames(result.vGenes)).toEqual(["ref_Vgene", "ref_2_Vgene", "ref_3_Vgene"]);
    expect(geneNames(result.jGenes)).toEqual(["ref_Jgene", "ref_2_Jgene", "ref_3_Jgene"]);
  });

  it("keeps every gene name distinct across a mixed batch", () => {
    const result = parseFasta(
      fasta(
        ["ref other words", VH_375NT],
        ["(((", VH_375NT],
        ["ref", VH_375NT],
        ["real_name", VH_375NT],
      ),
    );

    const names = geneNames(result.vGenes);
    expect(names).toHaveLength(4);
    expect(new Set(names).size).toBe(4);
  });
});

describe("parseFasta validation", () => {
  it("accepts a full-length reference and splits it into V and J", () => {
    const result = parseFasta(fasta(["ref", VH_375NT]));

    expect(result.isValid).toBe(true);
    // The split is a partition of the sequence: V ends where J begins.
    const v = (result.vGenes ?? "").split("\n").slice(1).join("");
    const j = (result.jGenes ?? "").split("\n").slice(1).join("");
    expect(v.length + j.length).toBe(375);
  });

  it("rejects amino-acid input as invalid DNA", () => {
    const result = parseFasta(fasta(["aa_ref", "EVQLVESGGGLVKPGGSLKLSCAASGFTLTSYTMNWVRQ"]));

    expect(result.isValid).toBe(false);
    expect(result.error).toContain("Invalid DNA characters");
  });

  it("rejects a sequence that is not a multiple of three", () => {
    const result = parseFasta(fasta(["ref", VH_375NT.replace(/\n/g, "") + "A"]));

    expect(result.isValid).toBe(false);
    expect(result.error).toContain("not a multiple of 3");
  });

  it("reports an empty FASTA", () => {
    expect(parseFasta("").isValid).toBe(false);
    expect(parseFasta("   ").error).toBe("FASTA content is empty");
  });
});

describe("parseFasta CDR3 location", () => {
  // The two tests below pin behaviour that already holds. They exist because the search
  // offset looks arbitrary and invites removal: across the 137 nucleotide references in
  // platforma-studies-library, searching the whole translated sequence instead anchors on
  // the FR1 cysteine in roughly half of them, and anchoring on the last match moves the
  // boundary in about ninety. Whatever finds the CDR3 has to keep these two intact.

  it("anchors on the CDR3 cysteine rather than the FR1 cysteine", () => {
    const result = parseFasta(fasta(["s1f4", VH_375NT]));

    expect(result.isValid).toBe(true);
    // S1-F4 carries cysteines at residues 21 (FR1) and 95 (CDR3). Anchoring on 21 would
    // cut V at 85 nt and hand the remaining 290 nt — nearly the whole domain — to J.
    expect(geneSequence(result.vGenes)).toHaveLength(315);
    expect(geneSequence(result.jGenes)).toHaveLength(60);
  });

  it("anchors on the first CDR3 when one record carries two variable domains", () => {
    const result = parseFasta(fasta(["scfv", SCFV_738NT]));

    expect(result.isValid).toBe(true);
    // An scFv has a CDR3 per domain — here at residues 88 and 212, the light chain first.
    // The boundary belongs to the first; taking the last would move V by 372 nt.
    expect(geneSequence(result.vGenes)).toHaveLength(295);
    expect(geneSequence(result.jGenes)).toHaveLength(443);
  });

  // A reference covering only the amplified region starts mid-FR1, which pulls its CDR3
  // cysteine ahead of the offset. The offset then hides the one cysteine that matters.
  it("locates a CDR3 that sits ahead of the search offset", () => {
    const result = parseFasta(fasta(["nanobody", VHH_303NT]));

    expect(result.isValid).toBe(true);
    expect(geneSequence(result.vGenes)).toHaveLength(253);
    expect(geneSequence(result.jGenes)).toHaveLength(50);
  });

  // The lenient path is the one that reaches a user: BuildLibraryPanel parses with
  // `lenient: true`, and on a miss it splits at two-thirds of the sequence and reports
  // success. For this reference that guess puts the boundary at 202 nt instead of 253 —
  // 51 nt of V handed to the J gene, with nothing shown in the UI to say so.
  it("splits a mid-FR1 reference at its real boundary in lenient mode", () => {
    const result = parseFasta(fasta(["nanobody", VHH_303NT]), undefined, true);

    expect(result.isValid).toBe(true);
    expect(geneSequence(result.vGenes)).toHaveLength(253);
    expect(geneSequence(result.jGenes)).toHaveLength(50);
  });
});

describe("parseFastaRecords", () => {
  it("reads a headerless sequence as one record", () => {
    const records = parseFastaRecords("ACGT\nACGT");

    expect(records).toEqual([{ header: "", sequence: "ACGTACGT" }]);
  });

  it("splits multiple records and joins wrapped sequence lines", () => {
    const records = parseFastaRecords(">a\nACGT\nTTTT\n>b\nGGGG");

    expect(records).toEqual([
      { header: "a", sequence: "ACGTTTTT" },
      { header: "b", sequence: "GGGG" },
    ]);
  });
});
