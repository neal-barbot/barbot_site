import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import { listConversations } from '@/modules/ai-support/service';
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
    });
    return respData(rows);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/ai-support/conversations')({
  server: {
    handlers: { GET },
  },
});
