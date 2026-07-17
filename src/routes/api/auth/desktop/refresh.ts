import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import {
  buildDesktopSession,
  verifyDesktopRefreshToken,
} from '@/modules/agent-gateway/desktop';

const bodySchema = z.object({ refreshToken: z.string().min(1) });

/** Rotate desktop session tokens. Plain JSON contract. */
async function POST({ request }: { request: Request }) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { message: 'refreshToken is required' } }, { status: 400 });
  }

  const claims = verifyDesktopRefreshToken(parsed.data.refreshToken);
  if (!claims) {
    return Response.json({ error: { message: 'Invalid refresh token' } }, { status: 401 });
  }

  const session = await buildDesktopSession(claims.userId);
  if (!session) return Response.json({ error: { message: 'User not found' } }, { status: 404 });
  return Response.json(session);
}

export const Route = createFileRoute('/api/auth/desktop/refresh')({
  server: { handlers: { POST } },
});
