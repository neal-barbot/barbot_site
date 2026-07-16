import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { respData, respErr } from '@/lib/resp';
import { pollDevice } from '@/modules/agent-gateway/device';

const bodySchema = z.object({ deviceCode: z.string().min(1).max(200) });

/**
 * Device-flow polling endpoint. Poll interval is enforced per deviceCode in
 * the store (slow_down), so no IP rate limit here.
 */
async function POST({ request }: { request: Request }) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respErr('deviceCode required');
  return respData(pollDevice(parsed.data.deviceCode));
}

export const Route = createFileRoute('/api/agent/device/token')({
  server: { handlers: { POST } },
});
