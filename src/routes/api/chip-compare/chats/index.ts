import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { respData, respErr } from '@/lib/resp';
import { resolveUserId } from '@/modules/apikeys/auth';
import { createChat, listChats } from '@/modules/chip-compare/chat-service';

const createSchema = z.object({
  title: z.string().max(200).optional().default(''),
});

async function GET({ request }: { request: Request }) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) return respErr('Unauthorized');

    const items = await listChats(userId);
    return respData({ items });
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

async function POST({ request }: { request: Request }) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) return respErr('Unauthorized');

    const body = await request.json().catch(() => ({}));
    const input = createSchema.parse(body ?? {});
    const created = await createChat(userId, input.title);
    return respData(created);
  } catch (error: any) {
    return respErr(error.issues?.[0]?.message || error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/chip-compare/chats/')({
  server: { handlers: { GET, POST } },
});
