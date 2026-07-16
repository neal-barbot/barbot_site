import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { respData, respErr } from '@/lib/resp';
import {
  recordUsage,
  verifyInternalToken,
  USAGE_SCENES,
} from '@/modules/agent-gateway/service';

const bodySchema = z.object({
  userId: z.string().min(1),
  scene: z.enum(USAGE_SCENES),
  units: z.number().int().min(1).max(1000).default(1),
  externalId: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
});

/**
 * Usage reporting from agent executors (service-to-service). Idempotent on
 * externalId — safe to retry. Pricing is resolved server-side per scene;
 * executors report units of work, never credit amounts.
 */
async function POST({ request }: { request: Request }) {
  if (!verifyInternalToken(request)) return respErr('Unauthorized');

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respErr(`Invalid body: ${parsed.error.issues[0]?.message}`);

  try {
    const result = await recordUsage(parsed.data);
    if (result.error) return respErr(result.error);
    return respData(result);
  } catch (error) {
    console.error('Usage recording failed:', error);
    return respErr('Usage recording failed');
  }
}

export const Route = createFileRoute('/api/internal/usage')({
  server: { handlers: { POST } },
});
