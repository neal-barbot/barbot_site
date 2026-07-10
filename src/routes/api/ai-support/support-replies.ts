import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import { createSupportReply } from '@/modules/ai-support/service';
import { respData, respErr } from '@/lib/resp';

async function POST({ request }: { request: Request }) {
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');
    const body = await request.json().catch(() => ({}));
    if (typeof body.escalationId !== 'string' || typeof body.content !== 'string') {
      return respErr('escalationId and content are required');
    }
    return respData(await createSupportReply({
      userId: session.user.id,
      escalationId: body.escalationId,
      content: body.content,
    }));
  } catch (error: unknown) {
    return respErr(error instanceof Error ? error.message : 'Unable to send support reply');
  }
}

export const Route = createFileRoute('/api/ai-support/support-replies')({
  server: { handlers: { POST } },
});
