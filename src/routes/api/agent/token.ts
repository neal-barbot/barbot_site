import { createFileRoute } from '@tanstack/react-router';
import { respData, respErr } from '@/lib/resp';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { resolveUserId } from '@/modules/apikeys/auth';
import { signAgentToken } from '@/modules/agent-gateway/service';
import { getBalance } from '@/modules/credits/service';

/**
 * Exchange a user credential (session cookie or API key Bearer) for a
 * short-lived agent JWT that external agent executors accept. The executor
 * verifies it offline with the shared AGENT_JWT_SECRET.
 */
async function POST({ request }: { request: Request }) {
  const limited = enforceMinIntervalRateLimit(request, {
    intervalMs: 1000,
    keyPrefix: 'agent-token',
  });
  if (limited) return limited;

  const userId = await resolveUserId(request);
  if (!userId) return respErr('Unauthorized');

  try {
    const { token, expiresAt } = signAgentToken(userId);
    const balance = await getBalance(userId);
    return respData({ token, expiresAt, userId, balance });
  } catch (error) {
    console.error('Agent token issuance failed:', error);
    return respErr('Token issuance failed');
  }
}

export const Route = createFileRoute('/api/agent/token')({
  server: { handlers: { POST } },
});
