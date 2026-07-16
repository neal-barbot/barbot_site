import { createFileRoute } from '@tanstack/react-router';
import { respData, respErr } from '@/lib/resp';
import { getAuth } from '@/core/auth';
import { getTraces } from '@/modules/chip-compare/service';

async function GET({ request, params }: { request: Request; params: { id: string } }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const traces = await getTraces(params.id, session.user.id);
    return respData(traces);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/chip-compare/records/$id/traces')({
  server: { handlers: { GET } },
});
