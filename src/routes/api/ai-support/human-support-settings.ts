import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import {
  getHumanSupportSettings,
  updateHumanSupportSettings,
} from '@/modules/ai-support/service';
import { respData, respErr } from '@/lib/resp';

function boolOrUndefined(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

async function GET({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get('chatbotId') || '';
    if (!chatbotId) return respErr('Chatbot id is required');

    const settings = await getHumanSupportSettings({
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

    const settings = await updateHumanSupportSettings({
      userId: session.user.id,
      chatbotId,
      settings: {
        enabled: boolOrUndefined(body.enabled),
        showEscalationButtons: boolOrUndefined(body.showEscalationButtons),
        replaceSuggestions: boolOrUndefined(body.replaceSuggestions),
        positivePrompt: typeof body.positivePrompt === 'string' ? body.positivePrompt : undefined,
        requestPrompt: typeof body.requestPrompt === 'string' ? body.requestPrompt : undefined,
        confirmationMessage:
          typeof body.confirmationMessage === 'string' ? body.confirmationMessage : undefined,
        notificationsEnabled: boolOrUndefined(body.notificationsEnabled),
        notificationEmail:
          typeof body.notificationEmail === 'string' ? body.notificationEmail : undefined,
        notificationWebhookUrl:
          typeof body.notificationWebhookUrl === 'string' ? body.notificationWebhookUrl : undefined,
      },
    });
    return respData(settings);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/ai-support/human-support-settings')({
  server: {
    handlers: { GET, PATCH },
  },
});
