import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { respData, respErr, respOk } from '@/lib/resp';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { resolveUserId } from '@/modules/apikeys/auth';
import {
  appendMessage,
  deleteChat,
  getChatMessages,
} from '@/modules/chip-compare/chat-service';
import { answerChipQuestion, type QaMessage } from '@/modules/chip-compare/qa-agent';

const sendSchema = z.object({
  content: z.string().min(1).max(8000),
  recordId: z.string().max(64).nullish(),
});

type Ctx = { request: Request; params: { id: string } };

async function GET({ request, params }: Ctx) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) return respErr('Unauthorized');

    const result = await getChatMessages(params.id, userId);
    if (!result) return respErr('Chat not found');
    return respData(result);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

async function POST({ request, params }: Ctx) {
  const limited = enforceMinIntervalRateLimit(request, {
    intervalMs: 2000,
    keyPrefix: 'chip-chat-send',
  });
  if (limited) return limited;

  try {
    const userId = await resolveUserId(request);
    if (!userId) return respErr('Unauthorized');

    const input = sendSchema.parse(await request.json());

    const userMessage = await appendMessage(params.id, userId, 'user', input.content);
    if (!userMessage) return respErr('Chat not found');

    const thread = await getChatMessages(params.id, userId);
    const history: QaMessage[] = (thread?.messages ?? [])
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .slice(-10)
      .map((msg) => ({ role: msg.role as QaMessage['role'], content: msg.content }));

    const answer = await answerChipQuestion({
      userId,
      recordId: input.recordId ?? null,
      messages: history,
    });

    const assistantMessage = await appendMessage(params.id, userId, 'assistant', answer);
    if (!assistantMessage) return respErr('Chat not found');
    return respData(assistantMessage);
  } catch (error: any) {
    return respErr(error.issues?.[0]?.message || error.message || 'Internal error');
  }
}

async function DELETE({ request, params }: Ctx) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) return respErr('Unauthorized');

    const deleted = await deleteChat(params.id, userId);
    if (!deleted) return respErr('Chat not found');
    return respOk();
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/chip-compare/chats/$id')({
  server: { handlers: { GET, POST, DELETE } },
});
