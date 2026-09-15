import { describe, expect, it } from "vitest";
import { parseFasta, parseFastaRecords } from "./parseFasta";

/**
 * The S1-F4 parental anti-CD98hc VH domain, 375 nt. A real reference that passes
 * validation, so each test reaches the gene-name code.
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

/** The header of that reference as the studies library ships it. */
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

  // repseqio reads a gene name as the fragment of a `file://<file>#<geneName>` URI and
  // parses it with Java `java.net.URI` (RFC 2396). Asserted as a character set, not with
  // JS `new URL()`: WHATWG URL percent-encodes illegal fragment characters and accepts
  // every header below.
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

  // Without the counter, both records get the gene name `shared_prefix`.
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

  // The fallback name shares the counter. Without it, every record here is `ref`.
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
    // V and J partition the sequence.
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
