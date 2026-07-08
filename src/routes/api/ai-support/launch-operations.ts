import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import {
  getLaunchOperationsSettings,
  updateLaunchOperationsSettings,
} from '@/modules/ai-support/service';
import { respData, respErr } from '@/lib/resp';

function boolOrUndefined(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

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

    const settings = await getLaunchOperationsSettings({
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

    const settings = await updateLaunchOperationsSettings({
      userId: session.user.id,
      chatbotId,
      settings: {
        backupConfigured: boolOrUndefined(body.backupConfigured),
        backupRunbookUrl: stringOrUndefined(body.backupRunbookUrl),
        errorAlertsEnabled: boolOrUndefined(body.errorAlertsEnabled),
        errorAlertWebhookUrl: stringOrUndefined(body.errorAlertWebhookUrl),
        logRetentionDays: numberOrUndefined(body.logRetentionDays),
        rateLimitEnabled: boolOrUndefined(body.rateLimitEnabled),
        domainWhitelistRequired: boolOrUndefined(body.domainWhitelistRequired),
      },
    });
    return respData(settings);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/ai-support/launch-operations')({
  server: {
    handlers: { GET, PATCH },
  },
});
