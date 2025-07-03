import { PlRef } from '@platforma-sdk/model';
import { z } from 'zod';

export const BlockArgsValid = z.object({
  input: PlRef,
  chains: z.string().default('IGHeavy'),
  title: z.string().optional(),
  librarySequence: z.string(),
  threePrimePrimer: z.string().optional(),
  fivePrimePrimer: z.string().optional(),
  vGene: z.string().optional(),
  jGene: z.string().optional(),
});
export type BlockArgsValid = z.infer<typeof BlockArgsValid>;

export const BlockArgs = BlockArgsValid.partial({ input: true });
export type BlockArgs = z.infer<typeof BlockArgs>;
