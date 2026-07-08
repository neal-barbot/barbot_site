import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import {
  createAgentConfigDraft,
  listAgentRuns,
  reviewAgentRun,
} from '@/modules/ai-support/service';
import { respData, respErr } from '@/lib/resp';

async function GET({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit') ?? '20');
    const rows = await listAgentRuns({
      userId: session.user.id,
      status: searchParams.get('status') || undefined,
      limit: Number.isFinite(limit) ? limit : 20,
    });
    return respData(rows);
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
    const row = await createAgentConfigDraft({
      userId: session.user.id,
      chatbotId: typeof body.chatbotId === 'string' ? body.chatbotId : '',
      action: typeof body.action === 'string' ? body.action : 'config.propose',
      summary: typeof body.summary === 'string' ? body.summary : '',
      settingKey: typeof body.settingKey === 'string' ? body.settingKey : '',
      content: typeof body.content === 'string' ? body.content : '',
      agentTokenId: typeof body.agentTokenId === 'string' ? body.agentTokenId : undefined,
    });
    return respData(row);
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
    const id = typeof body.id === 'string' ? body.id : '';
    const decision = body.decision === 'approve' || body.decision === 'reject' ? body.decision : '';
    if (!id) return respErr('Agent run id is required');
    if (!decision) return respErr('Decision must be approve or reject');

    const row = await reviewAgentRun({
      userId: session.user.id,
      id,
      decision,
    });
    return respData(row);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/ai-support/agent-runs')({
  server: {
    handlers: { GET, POST, PATCH },
  },
});
