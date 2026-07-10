import { createFileRoute } from '@tanstack/react-router';
import {
  authenticateAgentToken,
  createKnowledgeSource,
  listKnowledgeSources,
  recordAgentAction,
} from '@/modules/ai-support/service';
import { respData, respErr } from '@/lib/resp';

function bearer(request: Request) {
  const value = request.headers.get('authorization') || '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

async function GET({ request }: { request: Request }) {
  try {
    const url = new URL(request.url);
    const chatbotId = url.searchParams.get('chatbotId') || undefined;
    const token = await authenticateAgentToken(bearer(request), { scope: 'knowledge.read', chatbotId });
    const rows = await listKnowledgeSources({ userId: token.userId, chatbotId });
    await recordAgentAction({
      userId: token.userId, tokenId: token.tokenId, chatbotId, action: 'agent.knowledge.read',
      summary: `Read ${rows.length} knowledge sources`, metadata: { count: rows.length },
    });
    return respData(rows);
  } catch (error: unknown) {
    return respErr(error instanceof Error ? error.message : 'Unauthorized');
  }
}

async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.chatbotId !== 'string' || typeof body.title !== 'string' || typeof body.type !== 'string') {
      return respErr('chatbotId, type, and title are required');
    }
    const token = await authenticateAgentToken(bearer(request), {
      scope: 'knowledge.propose', chatbotId: body.chatbotId,
    });
    const source = await createKnowledgeSource({
      userId: token.userId, chatbotId: body.chatbotId, type: body.type,
      title: body.title, content: typeof body.content === 'string' ? body.content : undefined,
      sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl : undefined,
      metadata: { proposedByAgent: token.tokenId },
    });
    await recordAgentAction({
      userId: token.userId, tokenId: token.tokenId, chatbotId: body.chatbotId,
      action: 'agent.knowledge.propose', status: 'pending_approval', approvalRequired: true,
      summary: `Proposed knowledge source ${source.title}`, metadata: { sourceId: source.id },
    });
    return respData(source);
  } catch (error: unknown) {
    return respErr(error instanceof Error ? error.message : 'Unauthorized');
  }
}

export const Route = createFileRoute('/api/agent/v1/knowledge-sources')({
  server: { handlers: { GET, POST } },
});
