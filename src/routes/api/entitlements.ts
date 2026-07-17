import { createFileRoute } from '@tanstack/react-router';
import { buildLegacyEntitlements, verifyDesktopBearer } from '@/modules/agent-gateway/desktop';

/** Legacy entitlements shape (BarbotAuthProvider.getEntitlements). Plain JSON. */
async function GET({ request }: { request: Request }) {
  const claims = verifyDesktopBearer(request);
  if (!claims) return Response.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  return Response.json(await buildLegacyEntitlements(claims.userId));
}

export const Route = createFileRoute('/api/entitlements')({
  server: { handlers: { GET } },
});
