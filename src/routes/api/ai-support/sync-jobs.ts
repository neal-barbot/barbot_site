import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import {
  listKnowledgeSyncJobs,
  runKnowledgeSyncJob,
  updateKnowledgeSyncJob,
} from '@/modules/ai-support/service';
import { respData, respErr } from '@/lib/resp';

async function GET({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get('chatbotId') || undefined;
    const rows = await listKnowledgeSyncJobs({
      userId: session.user.id,
      chatbotId,
    });
    return respData(rows);
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
    const sourceId = typeof body.sourceId === 'string' ? body.sourceId : '';
    if (!sourceId) return respErr('Knowledge source id is required');
    const intervalMinutes = typeof body.intervalMinutes === 'number' ? body.intervalMinutes : undefined;
    const enabled = typeof body.enabled === 'boolean' ? body.enabled : undefined;
    return respData(await updateKnowledgeSyncJob({ userId: session.user.id, sourceId, enabled, intervalMinutes }));
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

async function POST({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const body = await request.json().catch(() => ({}));
    const sourceId = typeof body.sourceId === 'string' ? body.sourceId : '';
    if (!sourceId) return respErr('Knowledge source id is required');

    const row = await runKnowledgeSyncJob({
      userId: session.user.id,
      sourceId,
    });
    return respData(row);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/ai-support/sync-jobs')({
  server: {
    handlers: { GET, POST, PATCH },
  },
});
