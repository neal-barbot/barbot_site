import { createFileRoute } from '@tanstack/react-router';
import {
  beginPublicConversationMessage,
  getPublicChatbot,
  getPublicConversationMessages,
  getPublicWidgetConfig,
} from '@/modules/ai-support/service';
import { createAgentTask, getPublicAgentTaskStatus, updateQueuedTaskMetadata } from '@/modules/agent-tasks/service';
import { getNonceStr, getUuid, md5 } from '@/lib/hash';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { respData, respErr } from '@/lib/resp';
import { isAllowedWidgetRequest } from '../-security';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function withCors(response: Response) {
  Object.entries(corsHeaders).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

function objectMetadata(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function POST({ request, params }: { request: Request; params: { publicKey: string } }) {
  try {
    const limited = enforceMinIntervalRateLimit(request, {
      intervalMs: 800,
      keyPrefix: 'ai-support-widget-message',
      extraKey: params.publicKey,
    });
    if (limited) return withCors(limited);

    const config = await getPublicWidgetConfig(params.publicKey);
    if (!isAllowedWidgetRequest(request, config.allowedDomains)) {
      return withCors(respErr('Origin is not allowed for this chatbot'));
    }

    const body = await request.json().catch(() => ({}));
    const conversationId = typeof body.conversationId === 'string' && body.conversationId
      ? body.conversationId
      : getUuid();
    const clientMessageId = typeof body.clientMessageId === 'string' && body.clientMessageId.trim()
      ? body.clientMessageId.trim().slice(0, 191)
      : getUuid();
    const pollToken = getNonceStr(48);
    const pollTokenExpiresAt = new Date(Date.now() + 5 * 60_000);
    const chatbot = await getPublicWidgetConfig(params.publicKey);
    const publicChatbot = await getPublicChatbot(params.publicKey);
    if (!publicChatbot) return withCors(respErr('Chatbot not found'));
    const taskResult = await createAgentTask({
      userId: publicChatbot.userId,
      chatbotId: chatbot.chatbotId,
      type: 'widget.answer',
      idempotencyKey: `${conversationId}:${clientMessageId}`,
      actor: { type: 'widget_visitor_session', id: typeof body.visitorId === 'string' ? body.visitorId.slice(0, 191) : params.publicKey, authorizationVersion: 'widget-v1', requestId: request.headers.get('x-request-id') ?? '' },
      inputSummary: 'Widget answer requested',
      metadata: { conversationId, pollTokenHash: md5(pollToken), pollTokenExpiresAt: pollTokenExpiresAt.toISOString() },
    });
    if (!taskResult.created) {
      return withCors(respErr('Duplicate widget message; retry with the original task token'));
    }
    const started = await beginPublicConversationMessage({
      publicKey: params.publicKey,
      conversationId,
      message: typeof body.message === 'string' ? body.message : '',
      visitorId: typeof body.visitorId === 'string' ? body.visitorId : undefined,
      sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl : undefined,
      contactName: typeof body.contactName === 'string' ? body.contactName : undefined,
      contactEmail: typeof body.contactEmail === 'string' ? body.contactEmail : undefined,
      metadata: objectMetadata(body.metadata),
    });
    await updateQueuedTaskMetadata({
      userId: started.chatbot.userId,
      taskId: taskResult.task.id,
      metadata: {
        conversationId: started.conversation.id,
        userMessageId: started.userMessage.id,
        publicKey: params.publicKey,
        pollTokenHash: md5(pollToken),
        pollTokenExpiresAt: pollTokenExpiresAt.toISOString(),
      },
    });

    const deadline = Date.now() + 8_000;
    while (Date.now() < deadline) {
      const task = await getPublicAgentTaskStatus({
        userId: started.chatbot.userId, chatbotId: started.chatbot.id, taskId: taskResult.task.id,
        conversationId: started.conversation.id, pollTokenHash: md5(pollToken),
      });
      if (task.status === 'succeeded') {
        const messages = await getPublicConversationMessages({ publicKey: params.publicKey, conversationId: started.conversation.id });
        const assistantMessage = [...messages].reverse().find((item) => item.role === 'assistant');
        if (assistantMessage) return withCors(respData({ conversation: started.conversation, userMessage: started.userMessage, assistantMessage }));
      }
      if (['failed_terminal', 'cancelled', 'rejected', 'expired'].includes(task.status)) {
        return withCors(respErr(task.errorSummary || 'Unable to answer this message'));
      }
      await sleep(250);
    }
    return withCors(respData({
      pending: true, conversation: started.conversation, userMessage: started.userMessage,
      taskId: taskResult.task.id, pollToken, pollTokenExpiresAt: pollTokenExpiresAt.toISOString(),
    }));
  } catch (error: any) {
    return withCors(respErr(error.message || 'Internal error'));
  }
}

function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export const Route = createFileRoute('/api/ai-support/widget/$publicKey/messages')({
  server: {
    handlers: { POST, OPTIONS },
  },
});
