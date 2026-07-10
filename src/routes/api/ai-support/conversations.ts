import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import { listConversations, updateConversation } from '@/modules/ai-support/service';
import { respData, respErr } from '@/lib/resp';

async function GET({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const { searchParams } = new URL(request.url);
    const rows = await listConversations({
      userId: session.user.id,
      chatbotId: searchParams.get('chatbotId') || undefined,
      status: searchParams.get('status') || undefined,
      feedback: searchParams.get('feedback') || undefined,
      search: searchParams.get('search') || undefined,
    });
    return respData(rows);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

async function PATCH({ request }: { request: Request }) {
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');
    const body = await request.json().catch(() => ({}));
    if (typeof body.id !== 'string') return respErr('Conversation id is required');
    return respData(await updateConversation({
      userId: session.user.id,
      id: body.id,
      status: body.status === 'open' || body.status === 'resolved' ? body.status : undefined,
      feedback: body.feedback === 'positive' || body.feedback === 'negative' || body.feedback === null
        ? body.feedback
        : undefined,
      tags: Array.isArray(body.tags) ? body.tags.filter((tag: unknown): tag is string => typeof tag === 'string') : undefined,
    }));
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/ai-support/conversations')({
  server: {
    handlers: { GET, PATCH },
  },
});
