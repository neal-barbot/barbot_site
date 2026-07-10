import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import { getLocalizationSettings, updateLocalizationSettings } from '@/modules/ai-support/service';
import { respData, respErr } from '@/lib/resp';

async function GET({ request }: { request: Request }) {
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');
    const chatbotId = new URL(request.url).searchParams.get('chatbotId');
    if (!chatbotId) return respErr('chatbotId is required');
    return respData(await getLocalizationSettings({ userId: session.user.id, chatbotId }));
  } catch (error: unknown) {
    return respErr(error instanceof Error ? error.message : 'Unable to load localization');
  }
}

async function PUT({ request }: { request: Request }) {
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');
    const body = await request.json().catch(() => ({}));
    if (typeof body.chatbotId !== 'string' || !body.settings || typeof body.settings !== 'object') {
      return respErr('chatbotId and settings are required');
    }
    return respData(await updateLocalizationSettings({
      userId: session.user.id,
      chatbotId: body.chatbotId,
      settings: body.settings,
    }));
  } catch (error: unknown) {
    return respErr(error instanceof Error ? error.message : 'Unable to save localization');
  }
}

export const Route = createFileRoute('/api/ai-support/localization')({
  server: { handlers: { GET, PUT } },
});
