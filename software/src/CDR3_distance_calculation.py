#!/usr/bin/env python3
"""
cdr3_distances.py

Compute minimal edit distances between CDR3s from a TSV table and a reference FASTA set.

Input:
  1) TSV with columns:
       - clonotypeKey
       - nSeqCDR3     (nucleotide CDR3)
       - aaSeqCDR3    (amino-acid CDR3)
  2) FASTA with nucleotide sequences of reference CDR3s (in-frame, length multiple of 3).

Output TSV (3 columns):
  - clonotypeKey
  - nMutationsCount   (min Levenshtein distance vs reference nucleotide set)
  - aaMutationsCount  (min Levenshtein distance vs reference amino-acid set)

Notes on "aaMutationsCount from nMutationsCount":
  In general you CANNOT derive aa edit distance from nucleotide edit distance reliably:
    - synonymous substitutions can change nucleotides without changing amino acids
    - different nucleotide edit paths can yield different amino-acid changes
    - indels/frameshifts break any simple mapping
  So we compute both distances, but we reuse the same reference set by translating refs once.

Performance:
  - Uses Myers bit-parallel Levenshtein distance (fast for lengths ~6–75).
  - Avoids polars row-wise UDF overhead by iterating Python lists and building result columns,
    then creating a polars DataFrame at the end.
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from typing import Dict, Iterable, List, Tuple

import polars as pl


# -----------------------------
# FASTA parsing + translation
# -----------------------------

DNA_COMPLEMENT = str.maketrans("acgtnACGTN", "tgcanTGCAN")

# Standard genetic code (DNA codons -> AA, '*' stop)
CODON_TABLE: Dict[str, str] = {
    # Phenylalanine / Leucine
    "TTT": "F", "TTC": "F", "TTA": "L", "TTG": "L",
    "CTT": "L", "CTC": "L", "CTA": "L", "CTG": "L",
    # Isoleucine / Methionine
    "ATT": "I", "ATC": "I", "ATA": "I", "ATG": "M",
    # Valine
    "GTT": "V", "GTC": "V", "GTA": "V", "GTG": "V",
    # Serine / Proline / Threonine / Alanine
    "TCT": "S", "TCC": "S", "TCA": "S", "TCG": "S",
    "CCT": "P", "CCC": "P", "CCA": "P", "CCG": "P",
    "ACT": "T", "ACC": "T", "ACA": "T", "ACG": "T",
    "GCT": "A", "GCC": "A", "GCA": "A", "GCG": "A",
    # Tyrosine / Histidine / Glutamine / Asparagine / Lysine / Aspartate / Glutamate
    "TAT": "Y", "TAC": "Y",
    "CAT": "H", "CAC": "H",
    "CAA": "Q", "CAG": "Q",
    "AAT": "N", "AAC": "N",
    "AAA": "K", "AAG": "K",
    "GAT": "D", "GAC": "D",
    "GAA": "E", "GAG": "E",
    # Cysteine / Tryptophan / Arginine / Glycine
    "TGT": "C", "TGC": "C",
    "TGG": "W",
    "CGT": "R", "CGC": "R", "CGA": "R", "CGG": "R",
    "AGT": "S", "AGC": "S",
    "AGA": "R", "AGG": "R",
    "GGT": "G", "GGC": "G", "GGA": "G", "GGG": "G",
    # Stops
    "TAA": "*", "TAG": "*", "TGA": "*",
}


def read_fasta_nuc(path: str) -> List[Tuple[str, str]]:
    """Return list of (header, sequence) from FASTA. Sequence uppercased, whitespace removed."""
    records: List[Tuple[str, str]] = []
    header = None
    seq_parts: List[str] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            if line.startswith(">"):
                if header is not None:
                    records.append((header, "".join(seq_parts).replace(" ", "").upper()))
                header = line[1:].strip()
                seq_parts = []
            else:
                seq_parts.append(line)
        if header is not None:
            records.append((header, "".join(seq_parts).replace(" ", "").upper()))
    return records


def translate_dna(seq: str, stop_at_stop: bool = False) -> str:
    """
    Translate DNA sequence (expects in-frame). Unknown/ambiguous codons -> 'X'.
    If stop_at_stop=True, translation truncates at first stop.
    """
    seq = seq.upper().replace("U", "T")
    if len(seq) % 3 != 0:
        # Keep going but last incomplete codon becomes X
        pass

    aa = []
    for i in range(0, len(seq) - 2, 3):
        codon = seq[i:i+3]
        a = CODON_TABLE.get(codon, "X")
        if stop_at_stop and a == "*":
            break
        aa.append(a)
    return "".join(aa)


# -----------------------------
# Myers bit-parallel distance
# -----------------------------

@dataclass(frozen=True)
class MyersPrecomp:
    peq: Dict[str, int]  # char -> bitmask
    m: int
    mask: int
    last: int


def myers_precompute(pattern: str) -> MyersPrecomp:
    """
    Precompute bitmasks for Myers algorithm for a given pattern.
    Works for any pattern length m >= 0, using Python big ints.
    """
    m = len(pattern)
    if m == 0:
        return MyersPrecomp(peq={}, m=0, mask=0, last=0)

    peq: Dict[str, int] = {}
    for i, ch in enumerate(pattern):
        peq[ch] = peq.get(ch, 0) | (1 << i)

    mask = (1 << m) - 1
    last = 1 << (m - 1)
    return MyersPrecomp(peq=peq, m=m, mask=mask, last=last)


def myers_distance(pre: MyersPrecomp, text: str, best_so_far: int | None = None) -> int:
    """
    Levenshtein distance(pattern, text) using Myers bit-parallel algorithm.

    If best_so_far is provided, we do a safe early-abort:
      - distance is always >= abs(len(text) - m)
      - while scanning, score can still decrease, so we can't just stop when score > best_so_far.
        However we can stop if current score - remaining_chars > best_so_far? Not tight due to indels.
    For simplicity and correctness, we only apply a length lower-bound before calling this,
    and keep this function exact (no risky early exits).
    """
    m = pre.m
    if m == 0:
        return len(text)

    peq = pre.peq
    mask = pre.mask
    last = pre.last

    # Initialize state
    pv = mask
    mv = 0
    score = m

    for ch in text:
        eq = peq.get(ch, 0)

        xv = eq | mv
        xh = (((eq & pv) + pv) ^ pv) | eq

        ph = mv | (~(xh | pv) & mask)
        mh = pv & xh

        if ph & last:
            score += 1
        elif mh & last:
            score -= 1

        ph = ((ph << 1) | 1) & mask
        mh = (mh << 1) & mask

        pv = (mh | (~(xv | ph) & mask)) & mask
        mv = (ph & xv) & mask

    return score


# -----------------------------
# Main computation
# -----------------------------

@dataclass(frozen=True)
class RefEntry:
    n_seq: str
    aa_seq: str
    n_pre: MyersPrecomp
    aa_pre: MyersPrecomp


def build_reference_set(fasta_path: str) -> List[RefEntry]:
    refs_raw = read_fasta_nuc(fasta_path)
    if not refs_raw:
        raise ValueError(f"No reference sequences found in FASTA: {fasta_path}")

    refs: List[RefEntry] = []
    for hdr, n_seq in refs_raw:
        if not n_seq:
            continue
        aa_seq = translate_dna(n_seq, stop_at_stop=False)
        refs.append(
            RefEntry(
                n_seq=n_seq,
                aa_seq=aa_seq,
                n_pre=myers_precompute(n_seq),
                aa_pre=myers_precompute(aa_seq),
            )
        )

    if not refs:
        raise ValueError(f"All reference sequences were empty in FASTA: {fasta_path}")

    return refs


def min_dist_to_refs(query: str, refs_pre: Iterable[MyersPrecomp]) -> tuple[int, int]:
    """
    Minimal Levenshtein distance from query to any reference pattern in refs_pre.
    Returns (min_distance, best_ref_length).
    Uses a length-difference lower-bound to skip hopeless refs.
    """
    best = 10**9
    best_ref_len = 0
    qlen = len(query)
    for pre in refs_pre:
        lb = abs(qlen - pre.m)
        if lb >= best:
            continue
        d = myers_distance(pre, query)
        if d < best:
            best = d
            best_ref_len = pre.m
            if best == 0:
                break
    if best == 10**9:
        return 0, 0
    return best, best_ref_len


def run(tsv_path: str, fasta_path: str, out_path: str | None) -> None:
    refs = build_reference_set(fasta_path)

    # Read TSV using polars
    df = pl.read_csv(tsv_path, separator="\t", infer_schema_length=1000)

    required = {"clonotypeKey", "nSeqCDR3", "aaSeqCDR3"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns in TSV: {sorted(missing)}")

    # Pull columns into Python lists for faster looping than row-wise UDFs
    keys = df["clonotypeKey"].to_list()
    n_seqs = df["nSeqCDR3"].fill_null("").to_list()
    aa_seqs = df["aaSeqCDR3"].fill_null("").to_list()

    n_refs_pre = [r.n_pre for r in refs]
    aa_refs_pre = [r.aa_pre for r in refs]

    n_out: List[int] = []
    aa_out: List[int] = []
    n_rate_out: List[float | None] = []
    aa_rate_out: List[float | None] = []

    for n_q, aa_q in zip(n_seqs, aa_seqs):
        n_q = (n_q or "").upper().replace("U", "T")
        aa_q = (aa_q or "").upper()

        # Minimal distances vs reference sets
        n_d, n_ref_len = min_dist_to_refs(n_q, n_refs_pre)
        aa_d, aa_ref_len = min_dist_to_refs(aa_q, aa_refs_pre)

        n_len = len(n_q)
        aa_len = len(aa_q)

        n_out.append(int(n_d))
        aa_out.append(int(aa_d))

        n_norm_denom = max(n_len, n_ref_len)
        aa_norm_denom = max(aa_len, aa_ref_len)
        n_rate_out.append((n_d / n_norm_denom) if n_norm_denom > 0 else None)
        aa_rate_out.append((aa_d / aa_norm_denom) if aa_norm_denom > 0 else None)

    out_df = pl.DataFrame(
        {
            "clonotypeKey": keys,
            "nMutationsCountCDR3": n_out,
            "aaMutationsCountCDR3": aa_out,
            "nMutationsRateCDR3": n_rate_out,
            "aaMutationsRateCDR3": aa_rate_out,
        }
    )

    if out_path and out_path != "-":
        out_df.write_csv(out_path, separator="\t")
    else:
        # stdout
        out_df.write_csv(sys.stdout, separator="\t")


def main() -> None:
    p = argparse.ArgumentParser(
        description="Compute minimal Myers (Levenshtein) distances of CDR3s vs reference FASTA (nucleotide + amino-acid)."
    )
    p.add_argument("--tsv", required=True, help="Input TSV with clonotypeKey, nSeqCDR3, aaSeqCDR3")
    p.add_argument("--ref-fasta", required=True, help="Reference FASTA with nucleotide CDR3 sequences")
    p.add_argument("--out", default="-", help="Output TSV path (default: stdout). Use '-' for stdout.")
    args = p.parse_args()

    run(args.tsv, args.ref_fasta, args.out)


if __name__ == "__main__":
    main()

