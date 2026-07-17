import { z } from 'zod';
import { getUuid } from '@/lib/hash';
import { recordUsage } from './service';

/** Token-usage entry reported by the Harvey client (shape fixed by the fork). */
export const usageEntrySchema = z.object({
  product: z.string().max(50),
  model: z.string().max(100),
  provider: z.string().max(50),
  type: z.literal('chat'),
  tokens: z.number().int().min(0),
  cost: z.number().min(0),
  input_tokens: z.number().int().min(0).optional(),
  output_tokens: z.number().int().min(0).optional(),
  cached_input_tokens: z.number().int().min(0).optional(),
  app_id: z.string().max(100).optional(),
  request_id: z.string().max(200).optional(),
  timestamp: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type UsageEntry = z.infer<typeof usageEntrySchema>;

/** 1 billing unit (= agent_task_cost_credits) per this many LLM tokens. */
export const TOKENS_PER_UNIT = 100_000;

/** Bill one usage entry against platform credits (idempotent on request_id). */
export async function billUsageEntry(userId: string, entry: UsageEntry) {
  const units = Math.max(1, Math.ceil(entry.tokens / TOKENS_PER_UNIT));
  return recordUsage({
    userId,
    scene: 'agent_task',
    units,
    externalId: entry.request_id || getUuid(),
    description: `Harvey chat: ${entry.model} (${entry.tokens} tokens)`,
  });
}
