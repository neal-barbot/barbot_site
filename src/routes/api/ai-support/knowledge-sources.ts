import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import {
  archiveKnowledgeSource,
  createKnowledgeSource,
  listKnowledgeSources,
  updateKnowledgeSource,
  type KnowledgeSourceType,
} from '@/modules/ai-support/service';
import { respData, respErr, respOk } from '@/lib/resp';

function stringArrayMetadata(input: unknown): Record<string, unknown> {
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
    const chatbotId = searchParams.get('chatbotId') || undefined;
    const type = (searchParams.get('type') || undefined) as KnowledgeSourceType | undefined;

    const rows = await listKnowledgeSources({
      userId: session.user.id,
      chatbotId,
      type,
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
    const row = await createKnowledgeSource({
      userId: session.user.id,
      chatbotId: typeof body.chatbotId === 'string' ? body.chatbotId : '',
      type: typeof body.type === 'string' ? body.type : '',
      title: typeof body.title === 'string' ? body.title : '',
      content: typeof body.content === 'string' ? body.content : undefined,
      sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl : undefined,
      metadata: stringArrayMetadata(body.metadata),
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
    if (!id) return respErr('Knowledge source id is required');

    const row = await updateKnowledgeSource({
      userId: session.user.id,
      id,
      title: typeof body.title === 'string' ? body.title : undefined,
      content: typeof body.content === 'string' ? body.content : undefined,
      sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl : undefined,
      status: typeof body.status === 'string' ? body.status : undefined,
      metadata: body.metadata === undefined ? undefined : stringArrayMetadata(body.metadata),
    });
    return respData(row);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

async function DELETE({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || '';
    if (!id) return respErr('Knowledge source id is required');

    await archiveKnowledgeSource({ userId: session.user.id, id });
    return respOk();
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/ai-support/knowledge-sources')({
  server: {
    handlers: { GET, POST, PATCH, DELETE },
  },
});
