import { createFileRoute } from '@tanstack/react-router';
import { getPublicChatbot, getPublicConversationMessages } from '@/modules/ai-support/service';
import { getPublicAgentTaskStatus } from '@/modules/agent-tasks/service';
import { md5 } from '@/lib/hash';
import { respData, respErr } from '@/lib/resp';
import { isAllowedWidgetRequest } from '../../-security';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function withCors(response: Response) {
  Object.entries(corsHeaders).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

async function GET({ request, params }: { request: Request; params: { publicKey: string; taskId: string } }) {
  try {
    const chatbot = await getPublicChatbot(params.publicKey);
    if (!chatbot) return withCors(respErr('Chatbot not found'));
    if (!isAllowedWidgetRequest(request, JSON.parse(chatbot.allowedDomains || '[]'))) {
      return withCors(respErr('Origin is not allowed for this chatbot'));
    }
    const url = new URL(request.url);
    const conversationId = url.searchParams.get('conversationId') || '';
    const pollToken = url.searchParams.get('pollToken') || '';
    if (!conversationId || !pollToken) return withCors(respErr('Conversation id and poll token are required'));
    const task = await getPublicAgentTaskStatus({
      userId: chatbot.userId, chatbotId: chatbot.id, taskId: params.taskId, conversationId, pollTokenHash: md5(pollToken),
    });
    if (task.status !== 'succeeded') return withCors(respData({ pending: !['failed_terminal', 'cancelled', 'rejected', 'expired'].includes(task.status), task }));
    const messages = await getPublicConversationMessages({ publicKey: params.publicKey, conversationId });
    const assistantMessage = [...messages].reverse().find((item) => item.role === 'assistant');
    return withCors(respData({ pending: false, task, assistantMessage: assistantMessage ?? null }));
  } catch (error: any) {
    return withCors(respErr(error.message || 'Unable to load task'));
  }
}

function OPTIONS() { return new Response(null, { status: 204, headers: corsHeaders }); }

export const Route = createFileRoute('/api/ai-support/widget/$publicKey/tasks/$taskId')({
  server: { handlers: { GET, OPTIONS } },
});
