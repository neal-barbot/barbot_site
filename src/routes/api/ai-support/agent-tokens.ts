import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import {
  createAgentTokenDraft,
  listAgentTokens,
  revokeAgentToken,
} from '@/modules/ai-support/service';
import { respData, respErr } from '@/lib/resp';

async function GET({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const rows = await listAgentTokens(session.user.id);
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
    const scopes = Array.isArray(body.scopes)
      ? body.scopes.filter((scope: unknown) => typeof scope === 'string')
      : [];
    const chatbotIds = Array.isArray(body.chatbotIds)
      ? body.chatbotIds.filter((id: unknown) => typeof id === 'string')
      : [];
    const expiresAt =
      typeof body.expiresAt === 'string' && body.expiresAt
        ? new Date(body.expiresAt)
        : null;

    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      return respErr('Invalid expiration date');
    }

    const result = await createAgentTokenDraft({
      userId: session.user.id,
      name,
      scopes,
      chatbotIds,
      expiresAt,
    });
    return respData(result);
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
    if (!id) return respErr('Agent token id is required');
    if (body.action !== 'revoke') return respErr('Unsupported agent token action');

    const row = await revokeAgentToken({
      userId: session.user.id,
      id,
    });
    return respData(row);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/ai-support/agent-tokens')({
  server: {
    handlers: { GET, POST, PATCH },
  },
});
