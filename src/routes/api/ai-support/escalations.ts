import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import {
  createEscalation,
  listEscalations,
  updateEscalation,
} from '@/modules/ai-support/service';
import { respData, respErr } from '@/lib/resp';

function objectMetadata(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

async function GET({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const { searchParams } = new URL(request.url);
    const rows = await listEscalations({
      userId: session.user.id,
      chatbotId: searchParams.get('chatbotId') || undefined,
      status: searchParams.get('status') || undefined,
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
    const row = await createEscalation({
      userId: session.user.id,
      chatbotId: typeof body.chatbotId === 'string' ? body.chatbotId : '',
      leadId: typeof body.leadId === 'string' ? body.leadId : undefined,
      conversationId: typeof body.conversationId === 'string' ? body.conversationId : undefined,
      summary: typeof body.summary === 'string' ? body.summary : undefined,
      metadata: objectMetadata(body.metadata),
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
    if (!id) return respErr('Escalation id is required');

    const row = await updateEscalation({
      userId: session.user.id,
      id,
      status: typeof body.status === 'string' ? body.status : undefined,
      assigneeUserId:
        typeof body.assigneeUserId === 'string'
          ? body.assigneeUserId
          : body.assigneeUserId === null
            ? null
            : undefined,
      summary: typeof body.summary === 'string' ? body.summary : undefined,
      metadata: body.metadata === undefined ? undefined : objectMetadata(body.metadata),
    });
    return respData(row);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/ai-support/escalations')({
  server: {
    handlers: { GET, POST, PATCH },
  },
});
