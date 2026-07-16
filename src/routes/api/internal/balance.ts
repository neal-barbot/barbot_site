import { createFileRoute } from '@tanstack/react-router';
import { respData, respErr } from '@/lib/resp';
import {
  getSceneUnitCost,
  verifyInternalToken,
  USAGE_SCENES,
  type UsageScene,
} from '@/modules/agent-gateway/service';
import { getBalance } from '@/modules/credits/service';

/**
 * Pre-flight balance check for agent executors. Optional `scene` + `units`
 * params let the executor ask "can this user afford N units of this work"
 * without knowing platform pricing.
 */
async function GET({ request }: { request: Request }) {
  if (!verifyInternalToken(request)) return respErr('Unauthorized');

  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  if (!userId) return respErr('userId required');

  const balance = await getBalance(userId);
  const scene = url.searchParams.get('scene');

  if (scene) {
    if (!USAGE_SCENES.includes(scene as UsageScene)) return respErr('Unknown scene');
    const units = Math.max(1, Number.parseInt(url.searchParams.get('units') || '1', 10) || 1);
    const unitCost = await getSceneUnitCost(scene as UsageScene);
    const required = unitCost * units;
    return respData({ balance, unitCost, required, sufficient: balance >= required });
  }

  return respData({ balance });
}

export const Route = createFileRoute('/api/internal/balance')({
  server: { handlers: { GET } },
});
