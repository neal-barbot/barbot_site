import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import { listAuditLogs } from '@/modules/ai-support/service';
import { respData, respErr } from '@/lib/resp';

async function GET({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? '20');
    const rows = await listAuditLogs(session.user.id, Number.isFinite(limit) ? limit : 20);
    return respData(rows);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/ai-support/audit-logs')({
  server: {
    handlers: { GET },
  },
});
