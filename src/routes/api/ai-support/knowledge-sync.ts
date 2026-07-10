import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import { listKnowledgeSources } from '@/modules/ai-support/service';
import { createAgentTask } from '@/modules/agent-tasks/service';
import { respData, respErr } from '@/lib/resp';

async function POST({ request }: { request: Request }) {
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');
    const body = await request.json().catch(() => ({}));
    if (typeof body.sourceId !== 'string') {
      return respErr('sourceId is required');
    }
    const source = (await listKnowledgeSources({ userId: session.user.id })).find((item) => item.id === body.sourceId);
    if (!source) return respErr('Knowledge source not found');
    const task = await createAgentTask({
      userId: session.user.id, chatbotId: source.chatbotId, type: 'knowledge.sync',
      idempotencyKey: `knowledge.sync:${body.sourceId}:${Date.now()}`,
      actor: { type: 'human_session', id: session.user.id, authorizationVersion: 'session', requestId: request.headers.get('x-request-id') ?? '' },
      inputSummary: `Knowledge sync requested for ${source.title}`,
      metadata: { sourceId: body.sourceId },
    });
    return respData({ task: task.task, queued: true });
  } catch (error: unknown) {
    return respErr(error instanceof Error ? error.message : 'Knowledge sync failed');
  }
}

export const Route = createFileRoute('/api/ai-support/knowledge-sync')({
  server: { handlers: { POST } },
});
