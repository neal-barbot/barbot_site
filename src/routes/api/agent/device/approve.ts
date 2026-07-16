import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { respData, respErr } from '@/lib/resp';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { resolveUserId } from '@/modules/apikeys/auth';
import { approveDevice, denyDevice, findByUserCode } from '@/modules/agent-gateway/device';

const bodySchema = z.object({
  userCode: z.string().min(1).max(20),
  action: z.enum(['approve', 'deny']).default('approve'),
});

/** Approve/deny a pairing code — requires a signed-in user (or API key). */
async function POST({ request }: { request: Request }) {
  const limited = enforceMinIntervalRateLimit(request, {
    intervalMs: 1000,
    keyPrefix: 'device-approve',
  });
  if (limited) return limited;

  const userId = await resolveUserId(request);
  if (!userId) return respErr('Unauthorized');

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respErr('userCode required');

  if (parsed.data.action === 'deny') {
    return denyDevice(parsed.data.userCode)
      ? respData({ ok: true })
      : respErr('code_not_found_or_expired');
  }

  const result = await approveDevice({ userCode: parsed.data.userCode, userId });
  if (!result.ok) return respErr(result.error);
  return respData({ ok: true });
}

/** Look up a pending code so the approval page can show its status. */
async function GET({ request }: { request: Request }) {
  const userId = await resolveUserId(request);
  if (!userId) return respErr('Unauthorized');
  const userCode = new URL(request.url).searchParams.get('code') || '';
  const record = findByUserCode(userCode);
  if (!record) return respErr('code_not_found_or_expired');
  return respData({ userCode: record.userCode, status: record.status });
}

export const Route = createFileRoute('/api/agent/device/approve')({
  server: { handlers: { GET, POST } },
});
