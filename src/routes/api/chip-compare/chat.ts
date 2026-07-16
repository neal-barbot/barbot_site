import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { respData, respErr } from '@/lib/resp';
import { getAuth } from '@/core/auth';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { validate as validateApiKey } from '@/modules/apikeys/service';
import { answerChipQuestion } from '@/modules/chip-compare/qa-agent';

const bodySchema = z.object({
  recordId: z.string().max(64).nullish(),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(8000),
      })
    )
    .min(1)
    .max(20),
});

/** Resolve the caller: browser session cookie OR `Authorization: Bearer <api key>` (agent interface). */
async function resolveUserId(request: Request): Promise<string | null> {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: request.headers });
  if (session?.user) return session.user.id;

  const bearer = request.headers.get('authorization');
  if (bearer?.startsWith('Bearer ')) {
    return validateApiKey(bearer.slice(7).trim());
  }
  return null;
}

async function POST({ request }: { request: Request }) {
  const limited = enforceMinIntervalRateLimit(request, {
    intervalMs: 2000,
    keyPrefix: 'chip-compare-chat',
  });
  if (limited) return limited;

  try {
    const userId = await resolveUserId(request);
    if (!userId) return respErr('Unauthorized');

    const input = bodySchema.parse(await request.json());
    const answer = await answerChipQuestion({
      userId,
      recordId: input.recordId ?? null,
      messages: input.messages,
    });
    return respData({ answer });
  } catch (error: any) {
    return respErr(error.issues?.[0]?.message || error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/chip-compare/chat')({
  server: { handlers: { POST } },
});
