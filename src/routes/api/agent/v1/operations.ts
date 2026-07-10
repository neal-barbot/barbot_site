import { createFileRoute } from '@tanstack/react-router';
import {
  authenticateAgentToken,
  getConversationWithMessages,
  recordAgentAction,
  runKnowledgeSyncJob,
  updateLead,
} from '@/modules/ai-support/service';
import { respData, respErr } from '@/lib/resp';

function bearer(request: Request) {
  const value = request.headers.get('authorization') || '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === 'string' ? body.action : '';
    const chatbotId = typeof body.chatbotId === 'string' ? body.chatbotId : undefined;
    const scope = action === 'knowledge.sync' ? 'knowledge.propose'
      : action === 'lead.update' ? 'lead.classify'
      : action === 'conversation.summarize' ? 'conversation.read'
      : action === 'reply.draft' ? 'lead.classify'
      : '';
    if (!scope) return respErr('Unsupported agent action');
    const token = await authenticateAgentToken(bearer(request), { scope, chatbotId });

    if (action === 'knowledge.sync') {
      if (typeof body.sourceId !== 'string') return respErr('sourceId is required');
      const job = await runKnowledgeSyncJob({ userId: token.userId, sourceId: body.sourceId });
      await recordAgentAction({ userId: token.userId, tokenId: token.tokenId, chatbotId, action, summary: `Synced knowledge source ${body.sourceId}` });
      return respData(job);
    }
    if (action === 'lead.update') {
      if (typeof body.leadId !== 'string') return respErr('leadId is required');
      const lead = await updateLead({ userId: token.userId, id: body.leadId, status: body.status, priority: body.priority, metadata: body.metadata });
      await recordAgentAction({ userId: token.userId, tokenId: token.tokenId, chatbotId: lead.chatbotId, action, summary: `Updated lead ${lead.id}` });
      return respData(lead);
    }
    if (action === 'conversation.summarize') {
      if (typeof body.conversationId !== 'string') return respErr('conversationId is required');
      const conversation = await getConversationWithMessages({ userId: token.userId, conversationId: body.conversationId });
      const summary = conversation.messages.slice(-8).map((message) => `${message.role}: ${message.content}`).join('\n').slice(0, 4000);
      const run = await recordAgentAction({ userId: token.userId, tokenId: token.tokenId, chatbotId: conversation.chatbotId, action, summary: 'Conversation summary generated', diff: { transcriptSummary: summary } });
      return respData({ run, summary });
    }
    if (typeof body.escalationId !== 'string' || typeof body.draft !== 'string') return respErr('escalationId and draft are required');
    const run = await recordAgentAction({
      userId: token.userId, tokenId: token.tokenId, chatbotId, action, status: 'pending_approval', approvalRequired: true,
      summary: 'Human support reply draft awaiting approval', diff: { escalationId: body.escalationId, draft: body.draft.slice(0, 8000) },
    });
    return respData(run);
  } catch (error: unknown) {
    return respErr(error instanceof Error ? error.message : 'Unauthorized');
  }
}

export const Route = createFileRoute('/api/agent/v1/operations')({
  server: { handlers: { POST } },
});
