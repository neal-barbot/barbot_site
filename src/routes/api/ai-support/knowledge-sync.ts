import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import { runConfiguredKnowledgeSync } from '@/modules/ai-support/service';
import { respData, respErr } from '@/lib/resp';

async function POST({ request }: { request: Request }) {
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');
    const body = await request.json().catch(() => ({}));
    if (typeof body.sourceId !== 'string') {
      return respErr('sourceId is required');
    }
    return respData(await runConfiguredKnowledgeSync({ userId: session.user.id, sourceId: body.sourceId }));
  } catch (error: unknown) {
    return respErr(error instanceof Error ? error.message : 'Knowledge sync failed');
  }
}

export const Route = createFileRoute('/api/ai-support/knowledge-sync')({
  server: { handlers: { POST } },
});
