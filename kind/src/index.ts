import type { ImportFileHandle, PlRef } from "@milaboratories/pl-model-common";
import { isPlRef } from "@milaboratories/pl-model-common";
import { assertParamsObject, defineBlockKind } from "@platforma-sdk/block-kind";
import { isBoolean, isPlainObject, isString } from "es-toolkit";
import { isArray, isNumber } from "es-toolkit/compat";
import { name, version } from "../package.json" with { type: "json" };

/**
 * How aggressively MiXCR clusters reads into clonotypes. `off` disables error
 * correction entirely.
 */
export type CloneClusteringMode = "relaxed" | "default" | "off";

/**
 * The MiXCR gene feature clonotypes are assembled by — `VDJRegion`, `CDR3` and
 * the like. Free text rather than a union: the UI offers presets but also a
 * "Custom (advanced)" entry that lets the user type any MiXCR feature
 * expression.
 */
export type AssemblingFeature = string;

/** The three stop codons, by their classical names. */
export type StopCodonType = "amber" | "ochre" | "opal";

/** Which amino acid each selected stop codon is rewritten to, if any. */
export type StopCodonReplacements = {
  amber?: string;
  ochre?: string;
  opal?: string;
};

/** Where the V/J reference comes from. Each mode reads a different set of params. */
export type ReferenceInputMode = "fastaFile" | "fastaSequence" | "libraryFile" | "buildLibrary";

/** Offsets of the V-gene region boundaries within its sequence. */
export type VAnchorPoints = {
  fr1Begin: number;
  cdr1Begin: number;
  fr2Begin: number;
  cdr2Begin: number;
  fr3Begin: number;
  cdr3Begin: number;
  vEnd: number;
};

/** Offsets of the J-gene region boundaries within its sequence. */
export type JAnchorPoints = {
  jBegin: number;
  fr4Begin: number;
  fr4End: number;
};

/** One V/J pair of the hand-built library, with its region boundaries marked. */
export type LibraryEntryDefinition = {
  name: string;
  vSequence: string;
  jSequence: string;
  vAnchorPoints: VAnchorPoints;
  jAnchorPoints: JAnchorPoints;
};

/**
 * This block's init-params contract — the input dataset, the V/J reference in
 * whichever form it was given, and the MiXCR settings applied to them.
 *
 * Excluded on purpose:
 *
 * - `perProcessMemGB` / `perProcessCPUs`. Resource allocation belongs to the
 *   machine a block runs on, not to a recipe carried between machines.
 * - `tableState`, pure view state of the QC report table.
 * - `title` and `defaultBlockLabel`. Both are derived: the first from the label
 *   of the chosen dataset, the second from that label plus `chains` and
 *   `assemblingFeature`. The UI recomputes them from the dataset options.
 * - `referenceFileHandle` and `buildLibraryFastaFile`. These are `upload://`
 *   handles signed by the desktop that opened the file dialog and resolve
 *   nowhere else. What the UI parses out of them — `vGenes` / `jGenes` and
 *   `libraryEntries` — travels instead, so the recipe survives without them.
 * - `selectedRecordHeaders`, the subset of FASTA records the user kept. The
 *   settings page clears it and re-derives the gene sequences from the whole
 *   input whenever the reference is re-read, so a carried value would be
 *   dropped before it could take effect.
 *
 * `libraryFile` is accepted here but only an `index://` handle is ever exported
 * — see the model's `templateParams`. An `index://` handle is `{storageId,
 * path}` and resolves for anyone whose server registers that storage; an
 * `upload://` one does not. It is still accepted rather than rejected, because
 * a parser stricter than the states the UI can reach would make the block
 * refuse its own exports, and a hand-written entry naming a local file is the
 * author's call to make.
 *
 * Every field is optional: a block may be created without a template, and a
 * template need not set all of them.
 */
export type BlockParams = {
  customBlockLabel?: string;
  datasetRef?: PlRef;
  chains?: string;
  tagPattern?: string;
  referenceInputMode?: ReferenceInputMode;
  librarySequence?: string;
  vGenes?: string;
  jGenes?: string;
  libraryFile?: ImportFileHandle;
  isLibraryFileGzipped?: boolean;
  libraryEntries?: LibraryEntryDefinition[];
  buildLibraryVGenes?: string;
  buildLibraryJGenes?: string;
  cloneClusteringMode?: CloneClusteringMode;
  assemblingFeature?: AssemblingFeature;
  badQualityThreshold?: number;
  disableLowQualityMapping?: boolean;
  imputeGermline?: boolean;
  stopCodonTypes?: StopCodonType[];
  stopCodonReplacements?: StopCodonReplacements;
  limitInput?: number;
};

// Identity comes from this package's own package.json, so the on-wire
// `{name}@{version}` reference can never drift from what is published; the
// bundler inlines the JSON import.
export const kind = defineBlockKind<BlockParams>({
  name,
  version,
  parseInitializationParams,
});

// Internals

type Guard<T> = (v: unknown) => v is T;
type Check<T> = { is: Guard<T>; must: string };

function check<T>(is: Guard<T>, must: string): Check<T> {
  return { is, must };
}

const REFERENCE_INPUT_MODES: readonly ReferenceInputMode[] = [
  "fastaFile",
  "fastaSequence",
  "libraryFile",
  "buildLibrary",
];

const CLONE_CLUSTERING_MODES: readonly CloneClusteringMode[] = ["relaxed", "default", "off"];

const STOP_CODON_TYPES: readonly StopCodonType[] = ["amber", "ochre", "opal"];

function isOneOf<T extends string>(allowed: readonly T[]): Guard<T> {
  return (v): v is T => isString(v) && (allowed as readonly string[]).includes(v);
}

function oneOfMust(allowed: readonly string[], asArray = false): string {
  const list = allowed.map((a) => `"${a}"`).join(", ");
  return asArray ? `an array drawn from ${list}` : `one of ${list}`;
}

function isArrayOf<T>(item: Guard<T>): Guard<T[]> {
  return (v): v is T[] => isArray(v) && v.every(item);
}

/** Both handle forms are `<scheme>://<scheme>/<urlencoded JSON>`; the scheme is the envelope. */
const isImportFileHandle: Guard<ImportFileHandle> = (v): v is ImportFileHandle =>
  isString(v) && (v.startsWith("upload://") || v.startsWith("index://"));

/**
 * A whole number. `Number.isInteger` rather than es-toolkit's `isInteger`,
 * which returns a plain boolean and so leaves the value un-narrowed.
 */
const isInteger: Guard<number> = (v): v is number => isNumber(v) && Number.isInteger(v);

function isIntAtLeast(min: number): Guard<number> {
  return (v): v is number => isInteger(v) && v >= min;
}

const isStopCodonReplacements: Guard<StopCodonReplacements> = (v): v is StopCodonReplacements =>
  isPlainObject(v) && STOP_CODON_TYPES.every((c) => v[c] === undefined || isString(v[c]));

const isAnchorPoints =
  <K extends string>(keys: readonly K[]): Guard<Record<K, number>> =>
  (v): v is Record<K, number> =>
    isPlainObject(v) && keys.every((k) => isInteger(v[k]));

const isVAnchorPoints = isAnchorPoints([
  "fr1Begin",
  "cdr1Begin",
  "fr2Begin",
  "cdr2Begin",
  "fr3Begin",
  "cdr3Begin",
  "vEnd",
] as const);

const isJAnchorPoints = isAnchorPoints(["jBegin", "fr4Begin", "fr4End"] as const);

const isLibraryEntry: Guard<LibraryEntryDefinition> = (v): v is LibraryEntryDefinition =>
  isPlainObject(v) &&
  isString(v.name) &&
  isString(v.vSequence) &&
  isString(v.jSequence) &&
  isVAnchorPoints(v.vAnchorPoints) &&
  isJAnchorPoints(v.jAnchorPoints);

/**
 * The runtime half of the contract. The `satisfies` clause is what stops it
 * drifting: every field `BlockParams` declares must appear here, and each guard
 * must narrow to that field's own type — so adding a param without a check
 * stops compiling.
 */
const CONTRACT = {
  customBlockLabel: check(isString, "a string"),
  datasetRef: check(isPlRef, "a reference to an input dataset"),
  chains: check(isString, 'a chain name such as "IGHeavy"'),
  tagPattern: check(isString, "a MiXCR tag pattern string"),
  referenceInputMode: check(isOneOf(REFERENCE_INPUT_MODES), oneOfMust(REFERENCE_INPUT_MODES)),
  librarySequence: check(isString, "FASTA text"),
  vGenes: check(isString, "FASTA text"),
  jGenes: check(isString, "FASTA text"),
  libraryFile: check(isImportFileHandle, "an upload:// or index:// file handle"),
  isLibraryFileGzipped: check(isBoolean, "a boolean"),
  libraryEntries: check(isArrayOf(isLibraryEntry), "an array of library entries"),
  buildLibraryVGenes: check(isString, "FASTA text"),
  buildLibraryJGenes: check(isString, "FASTA text"),
  cloneClusteringMode: check(isOneOf(CLONE_CLUSTERING_MODES), oneOfMust(CLONE_CLUSTERING_MODES)),
  assemblingFeature: check(isString, "a MiXCR gene feature expression"),
  badQualityThreshold: check(isIntAtLeast(0), "a whole number of 0 or more"),
  disableLowQualityMapping: check(isBoolean, "a boolean"),
  imputeGermline: check(isBoolean, "a boolean"),
  stopCodonTypes: check(isArrayOf(isOneOf(STOP_CODON_TYPES)), oneOfMust(STOP_CODON_TYPES, true)),
  stopCodonReplacements: check(
    isStopCodonReplacements,
    "an object mapping amber/ochre/opal to an amino acid",
  ),
  limitInput: check(isInteger, "a whole number of reads"),
} satisfies { [K in keyof Required<BlockParams>]: Check<NonNullable<BlockParams[K]>> };

/**
 * The contract at runtime, for params arriving from a template file rather than
 * typed code. An absent field is always allowed — every param is optional and
 * the block's own default takes over — so each guard runs only on what is
 * present. Keys the contract does not name are dropped by never being read.
 */
function parseInitializationParams(value: unknown): BlockParams {
  assertParamsObject(value);

  const params: Record<string, unknown> = {};
  for (const [field, { is, must }] of Object.entries(CONTRACT)) {
    const v = value[field];
    if (v === undefined) continue;
    if (!is(v)) throw new Error(`'${field}' must be ${must}.`);
    params[field] = v;
  }
  return params as BlockParams;
}
