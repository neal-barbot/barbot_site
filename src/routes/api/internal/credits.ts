import { createFileRoute } from '@tanstack/react-router';
import { envConfigs } from '@/config';
import { respData, respErr } from '@/lib/resp';
import { getBalance, consume } from '@/modules/credits/service';

async function POST({ request }: { request: Request }) {
  const token = request.headers.get('x-internal-token');
  if (!token || token !== envConfigs.internal_api_token) return respErr('Unauthorized');

  const body = (await request.json()) as {
    action?: string;
    userId?: string;
    amount?: number;
    scene?: string;
  };
  const { action, userId } = body;
  if (!userId) return respErr('userId required');

  if (action === 'check') {
    const balance = await getBalance(userId);
    return respData({ ok: balance > 0, balance });
  }

  if (action === 'consume') {
    const credits = body.amount ?? Number(envConfigs.credit_cost_per_prompt);
    const result = await consume({ userId, credits, scene: body.scene ?? 'docqa_prompt' });
    return respData({ ok: result.success });
  }

  return respErr('unknown action');
}

export const Route = createFileRoute('/api/internal/credits')({
  server: { handlers: { POST } },
});
