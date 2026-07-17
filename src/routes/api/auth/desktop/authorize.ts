import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getAuth } from '@/core/auth';
import { respData, respErr } from '@/lib/resp';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { createExchangeCode, isLoopbackCallback } from '@/modules/agent-gateway/desktop';

const bodySchema = z.object({ callback: z.string().min(1).max(500) });

/**
 * Called by our own /auth/desktop page (session cookie) after the user
 * clicks Authorize — mints the one-time exchange code for the desktop client.
 */
async function POST({ request }: { request: Request }) {
  const limited = enforceMinIntervalRateLimit(request, {
    intervalMs: 1000,
    keyPrefix: 'desktop-authorize',
  });
  if (limited) return limited;

  const auth = getAuth();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return respErr('Unauthorized');

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return respErr('callback required');
  if (!isLoopbackCallback(parsed.data.callback)) return respErr('callback must be a loopback URL');

  return respData({ code: createExchangeCode(session.user.id) });
}

export const Route = createFileRoute('/api/auth/desktop/authorize')({
  server: { handlers: { POST } },
});
