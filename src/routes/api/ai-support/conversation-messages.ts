import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import { getConversationWithMessages } from '@/modules/ai-support/service';
import { respData, respErr } from '@/lib/resp';

async function GET({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId') || '';
    if (!conversationId) return respErr('Conversation id is required');

    const row = await getConversationWithMessages({
      userId: session.user.id,
      conversationId,
    });
    return respData(row);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/ai-support/conversation-messages')({
  server: {
    handlers: { GET },
  },
});
