import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

// A sample analysed before an update is recovered only while :mixcr-analyze keeps the identity
// of the published block: the same hash override and exactly the same declared outputs. A pure
// template locks its declared outputs before its body runs, and an output name with no stored
// result runs the body, so a fifth output re-runs every old sample even though the four old
// fields still read as recovered.
const PUBLISHED_HASH_OVERRIDE = "BE6EBF10-B660-4B96-AAA5-B73959F6BFD0";
const PUBLISHED_OUTPUTS = ["qc", "reports", "log", "clns"];

function template(name: string): string {
  return readFileSync(new URL(`../../workflow/src/${name}.tpl.tengo`, import.meta.url), "utf8");
}

function declaredOutputs(source: string): string[] {
  const m = source.match(/self\.defineOutputs\(([^)]*)\)/);
  expect(m, "defineOutputs").not.toBeNull();
  return [...m![1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

function hashOverride(source: string): string | undefined {
  return source.match(/^\/\/tengo:hash_override (\S+)$/m)?.[1];
}

describe(":mixcr-analyze keeps the published analysis identity", () => {
  test("same hash override", () => {
    expect(hashOverride(template("mixcr-analyze"))).toEqual(PUBLISHED_HASH_OVERRIDE);
  });

  test("exactly the published outputs", () => {
    expect(declaredOutputs(template("mixcr-analyze"))).toEqual(PUBLISHED_OUTPUTS);
  });

  test("the templates it renders carry overrides of their own", () => {
    const own = ["run-mixcr", "run-steps"].map((n) => hashOverride(template(n)));
    expect(own.every((o) => o !== undefined)).toBe(true);
    expect(new Set([PUBLISHED_HASH_OVERRIDE, ...own]).size).toBe(3);
  });
});
