import { PlRef } from '@platforma-sdk/model';
import { z } from 'zod';

export const BlockArgsValid = z.object({
  input: PlRef,
  chains: z.string().default('IGHeavy'),
  title: z.string().optional(),
  librarySequence: z.string(),
  threePrimePrimer: z.string().optional(),
  fivePrimePrimer: z.string().optional(),
  vGenes: z.string().optional(), // now a single FASTA string
  jGenes: z.string().optional(), // now a single FASTA string
  limitInput: z.number().int().optional(),
  perProcessMemGB: z.number().int().gte(1, '1GB or more required').optional(),
  perProcessCPUs: z.number().int().gte(1, '1 or more required').optional(),
});
export type BlockArgsValid = z.infer<typeof BlockArgsValid>;

export const BlockArgs = BlockArgsValid.partial({ input: true });
export type BlockArgs = z.infer<typeof BlockArgs>;
