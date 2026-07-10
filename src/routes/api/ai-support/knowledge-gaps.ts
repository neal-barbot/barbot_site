import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import { createKnowledgeGap, listKnowledgeGaps } from '@/modules/ai-support/service';
import { respData, respErr } from '@/lib/resp';

async function GET({ request }: { request: Request }) {
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');
    const chatbotId = new URL(request.url).searchParams.get('chatbotId') || undefined;
    return respData(await listKnowledgeGaps({ userId: session.user.id, chatbotId }));
  } catch (error: unknown) {
    return respErr(error instanceof Error ? error.message : 'Unable to load knowledge gaps');
  }
}

async function POST({ request }: { request: Request }) {
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');
    const body = await request.json().catch(() => ({}));
    if (typeof body.chatbotId !== 'string' || typeof body.question !== 'string') {
      return respErr('chatbotId and question are required');
    }
    return respData(await createKnowledgeGap({
      userId: session.user.id,
      chatbotId: body.chatbotId,
      conversationId: typeof body.conversationId === 'string' ? body.conversationId : undefined,
      question: body.question,
    }));
  } catch (error: unknown) {
    return respErr(error instanceof Error ? error.message : 'Unable to create knowledge gap');
  }
}

export const Route = createFileRoute('/api/ai-support/knowledge-gaps')({
  server: { handlers: { GET, POST } },
});
