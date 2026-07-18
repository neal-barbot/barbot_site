import { createFileRoute } from '@tanstack/react-router';
import {
  buildEntitlementV1,
  ensureDesktopLlmQuota,
  getDesktopUser,
  verifyDesktopBearer,
} from '@/modules/agent-gateway/desktop';

/** V1 entitlement (snake_case quota; fetchEntitlementV1). Plain JSON. */
async function GET({ request }: { request: Request }) {
  const claims = verifyDesktopBearer(request);
  if (!claims) return Response.json({ error: { message: 'Unauthorized' } }, { status: 401 });

  try {
    const desktopUser = await getDesktopUser(claims.userId);
    await ensureDesktopLlmQuota(claims.userId, desktopUser?.email);
  } catch (err) {
    console.error('[entitlement] ensureDesktopLlmQuota failed:', err);
  }

  const product = new URL(request.url).searchParams.get('product') || 'desktop_code';
  return Response.json(await buildEntitlementV1(claims.userId, product));
}

export const Route = createFileRoute('/api/v1/entitlement')({
  server: { handlers: { GET } },
});
