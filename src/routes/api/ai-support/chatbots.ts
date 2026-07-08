import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import { createChatbot, listChatbots, updateChatbot } from '@/modules/ai-support/service';
import { respData, respErr } from '@/lib/resp';

async function GET({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const rows = await listChatbots(session.user.id);
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
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const allowedDomains = Array.isArray(body.allowedDomains)
      ? body.allowedDomains.filter((domain: unknown) => typeof domain === 'string')
      : [];

    const row = await createChatbot({
      userId: session.user.id,
      name,
      description,
      allowedDomains,
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
    if (!id) return respErr('Chatbot id is required');

    const allowedDomains = Array.isArray(body.allowedDomains)
      ? body.allowedDomains.filter((domain: unknown) => typeof domain === 'string')
      : undefined;

    const row = await updateChatbot({
      userId: session.user.id,
      id,
      name: typeof body.name === 'string' ? body.name : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      status: typeof body.status === 'string' ? body.status : undefined,
      installStatus: typeof body.installStatus === 'string' ? body.installStatus : undefined,
      allowedDomains,
    });
    return respData(row);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/ai-support/chatbots')({
  server: {
    handlers: { GET, POST, PATCH },
  },
});
