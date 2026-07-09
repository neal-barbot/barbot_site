import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import {
  getPromptPersonaSettings,
  updatePromptPersonaSettings,
} from '@/modules/ai-support/service';
import { respData, respErr } from '@/lib/resp';

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

async function GET({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get('chatbotId') || '';
    if (!chatbotId) return respErr('Chatbot id is required');

    const settings = await getPromptPersonaSettings({
      userId: session.user.id,
      chatbotId,
    });
    return respData(settings);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

async function PATCH({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const body = await request.json().catch(() => ({}));
    const chatbotId = typeof body.chatbotId === 'string' ? body.chatbotId : '';
    if (!chatbotId) return respErr('Chatbot id is required');

    const settings = await updatePromptPersonaSettings({
      userId: session.user.id,
      chatbotId,
      settings: {
        instructions: stringOrUndefined(body.instructions),
        persona: stringOrUndefined(body.persona),
      },
    });
    return respData(settings);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/ai-support/prompt-persona')({
  server: {
    handlers: { GET, PATCH },
  },
});
