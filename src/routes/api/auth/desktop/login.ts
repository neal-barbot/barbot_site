import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { getAuth } from '@/core/auth';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { buildDesktopSession } from '@/modules/agent-gateway/desktop';

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceInfo: z.string().optional(),
});

/** Email+password desktop login (the non-browser fallback path). Plain JSON. */
async function POST({ request }: { request: Request }) {
  const limited = enforceMinIntervalRateLimit(request, {
    intervalMs: 2000,
    keyPrefix: 'desktop-login',
  });
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { message: 'email and password are required' } }, { status: 400 });
  }

  try {
    const auth = getAuth();
    const result = await auth.api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password },
    });
    const userId = (result as { user?: { id?: string } })?.user?.id;
    if (!userId) {
      return Response.json({ error: { message: 'Invalid credentials' } }, { status: 401 });
    }
    const session = await buildDesktopSession(userId);
    if (!session) return Response.json({ error: { message: 'User not found' } }, { status: 404 });
    return Response.json(session);
  } catch {
    return Response.json({ error: { message: 'Invalid credentials' } }, { status: 401 });
  }
}

export const Route = createFileRoute('/api/auth/desktop/login')({
  server: { handlers: { POST } },
});
