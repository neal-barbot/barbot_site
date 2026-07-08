import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import {
  listConfigVersions,
  rollbackConfigVersion,
} from '@/modules/ai-support/service';
import { respData, respErr } from '@/lib/resp';

async function GET({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit') ?? '20');
    const rows = await listConfigVersions({
      userId: session.user.id,
      chatbotId: searchParams.get('chatbotId') || undefined,
      settingKey: searchParams.get('settingKey') || undefined,
      limit: Number.isFinite(limit) ? limit : 20,
    });
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
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) return respErr('Config version id is required');

    const row = await rollbackConfigVersion({
      userId: session.user.id,
      id,
    });
    return respData(row);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/ai-support/config-versions')({
  server: {
    handlers: { GET, POST },
  },
});
