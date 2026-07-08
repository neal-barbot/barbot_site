import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import {
  createLead,
  listLeads,
  updateLead,
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
    const rows = await listLeads({
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
    const row = await createLead({
      userId: session.user.id,
      chatbotId: typeof body.chatbotId === 'string' ? body.chatbotId : '',
      conversationId: typeof body.conversationId === 'string' ? body.conversationId : undefined,
      name: typeof body.name === 'string' ? body.name : undefined,
      email: typeof body.email === 'string' ? body.email : undefined,
      phone: typeof body.phone === 'string' ? body.phone : undefined,
      sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl : undefined,
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
    if (!id) return respErr('Lead id is required');

    const row = await updateLead({
      userId: session.user.id,
      id,
      status: typeof body.status === 'string' ? body.status : undefined,
      priority: typeof body.priority === 'string' ? body.priority : undefined,
      metadata: body.metadata === undefined ? undefined : objectMetadata(body.metadata),
    });
    return respData(row);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/ai-support/leads')({
  server: {
    handlers: { GET, POST, PATCH },
  },
});
