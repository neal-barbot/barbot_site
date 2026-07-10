import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import { getConversationButtons, updateConversationButtons } from '@/modules/ai-support/service';
import { respData, respErr } from '@/lib/resp';

function kind(value: string | null): 'starters' | 'followups' | null {
  return value === 'starters' || value === 'followups' ? value : null;
}

async function GET({ request }: { request: Request }) {
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');
    const url = new URL(request.url);
    const chatbotId = url.searchParams.get('chatbotId');
    const buttonKind = kind(url.searchParams.get('kind'));
    if (!chatbotId || !buttonKind) return respErr('chatbotId and kind are required');
    return respData(await getConversationButtons({ userId: session.user.id, chatbotId, kind: buttonKind }));
  } catch (error: unknown) {
    return respErr(error instanceof Error ? error.message : 'Unable to load conversation buttons');
  }
}

async function PUT({ request }: { request: Request }) {
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');
    const body = await request.json().catch(() => ({}));
    const buttonKind = kind(typeof body.kind === 'string' ? body.kind : null);
    if (typeof body.chatbotId !== 'string' || !buttonKind || !Array.isArray(body.buttons)) {
      return respErr('chatbotId, kind, and buttons are required');
    }
    return respData(await updateConversationButtons({
      userId: session.user.id,
      chatbotId: body.chatbotId,
      kind: buttonKind,
      buttons: body.buttons,
    }));
  } catch (error: unknown) {
    return respErr(error instanceof Error ? error.message : 'Unable to save conversation buttons');
  }
}

export const Route = createFileRoute('/api/ai-support/conversation-buttons')({
  server: { handlers: { GET, PUT } },
});
