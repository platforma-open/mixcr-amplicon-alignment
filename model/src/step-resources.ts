import { z } from "zod";

/** Per-step replacement of the workflow's sizing rule; an unset field keeps the rule's value. */
export const StepResourceOverride = z
  .object({
    memFloor: z.number().int().gte(1).optional(),
    memIntercept: z.number().int().gte(0).optional(),
    memSlope: z.number().gte(0).optional(),
    cap: z.number().int().gte(1).optional(),
    cpuIntercept: z.number().int().gte(1).optional(),
    cpuSlope: z.number().gte(0).optional(),
  })
  .refine((o) => o.cap === undefined || o.memFloor === undefined || o.cap >= o.memFloor, {
    message: "Cap must be at least the memory floor",
  });
export type StepResourceOverride = z.infer<typeof StepResourceOverride>;

/** Keyed by step: the MiXCR command. */
export const StepResources = z.record(z.string(), StepResourceOverride);
export type StepResources = z.infer<typeof StepResources>;

/** The fields of a workflow sizing row a per-step override may replace. */
export type StepRule = {
  memFloor: number;
  memIntercept: number;
  memSlope: number;
  cap?: number;
  cpuIntercept: number;
  cpuSlope?: number;
};

/** What `step-defaults.tpl.tengo` reports: the planned steps. */
export type StepDefaults = { steps: { step: string; class: string; defaultRule: StepRule }[] };

/** Drops steps whose override sets no field, so clearing a row leaves no trace in the args. */
export function dropEmptyOverrides(o: StepResources | undefined): StepResources | undefined {
  if (o === undefined) return undefined;
  const kept = Object.entries(o)
    .map(
      ([step, v]) =>
        [step, Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined))] as const,
    )
    .filter(([, v]) => Object.keys(v).length > 0);
  return kept.length > 0 ? Object.fromEntries(kept) : undefined;
}
