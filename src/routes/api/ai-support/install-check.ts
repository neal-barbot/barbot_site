import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import { checkChatbotInstallation } from '@/modules/ai-support/service';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { respData, respErr } from '@/lib/resp';

async function POST({ request }: { request: Request }) {
  try {
    const limited = enforceMinIntervalRateLimit(request, {
      intervalMs: 10_000,
      keyPrefix: 'ai-support-install-check',
    });
    if (limited) return limited;

    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const body = await request.json().catch(() => ({}));
    const chatbotId = typeof body.chatbotId === 'string' ? body.chatbotId : '';
    const url = typeof body.url === 'string' ? body.url : '';
    if (!chatbotId) return respErr('Chatbot id is required');

    const result = await checkChatbotInstallation({
      userId: session.user.id,
      chatbotId,
      url,
    });
    return respData(result);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/ai-support/install-check')({
  server: {
    handlers: { POST },
  },
});
