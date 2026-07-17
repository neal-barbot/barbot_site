import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import {
  buildDesktopSession,
  consumeExchangeCode,
} from '@/modules/agent-gateway/desktop';

const bodySchema = z.object({ code: z.string().min(1).max(200), deviceInfo: z.string().optional() });

/** Desktop client exchanges the one-time code for tokens. Plain JSON contract. */
async function POST({ request }: { request: Request }) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { message: 'code is required' } }, { status: 400 });
  }

  const userId = consumeExchangeCode(parsed.data.code);
  if (!userId) {
    return Response.json({ error: { message: 'Invalid or expired code' } }, { status: 401 });
  }

  const session = await buildDesktopSession(userId);
  if (!session) return Response.json({ error: { message: 'User not found' } }, { status: 404 });
  return Response.json(session);
}

export const Route = createFileRoute('/api/auth/desktop/exchange')({
  server: { handlers: { POST } },
});
