import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { respData, respErr } from '@/lib/resp';
import { getAuth } from '@/core/auth';
import { hasPermission } from '@/modules/rbac/service';
import { MAX_CHIPS, MIN_CHIPS, preheat } from '@/modules/chip-compare/service';

const bodySchema = z.object({
  parts: z.array(z.string().min(1).max(128)).min(MIN_CHIPS).max(MAX_CHIPS),
  language: z.string().max(20).default('en'),
});

async function POST({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');
    const isAdmin = await hasPermission(session.user.id, 'admin.*');
    if (!isAdmin) return respErr('Forbidden');

    const input = bodySchema.parse(await request.json());
    preheat({
      adminUserId: session.user.id,
      parts: input.parts,
      language: input.language,
    });
    return respData({ started: true });
  } catch (error: any) {
    return respErr(error.issues?.[0]?.message || error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/admin/chip-compare/preheat')({
  server: { handlers: { POST } },
});
