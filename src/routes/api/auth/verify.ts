import { createFileRoute } from '@tanstack/react-router';
import { getDesktopUser, verifyDesktopBearer } from '@/modules/agent-gateway/desktop';

/** Bearer desktop token → { valid, user }. Plain JSON contract. */
async function GET({ request }: { request: Request }) {
  const claims = verifyDesktopBearer(request);
  if (!claims) return Response.json({ valid: false }, { status: 401 });

  const user = await getDesktopUser(claims.userId);
  if (!user) return Response.json({ valid: false }, { status: 401 });
  return Response.json({ valid: true, user });
}

export const Route = createFileRoute('/api/auth/verify')({
  server: { handlers: { GET } },
});
