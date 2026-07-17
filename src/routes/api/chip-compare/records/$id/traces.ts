import { createFileRoute } from '@tanstack/react-router';
import { resolveUserId } from '@/modules/apikeys/auth';
import { respData, respErr } from '@/lib/resp';
import { getTraces } from '@/modules/chip-compare/service';

async function GET({ request, params }: { request: Request; params: { id: string } }) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) return respErr('Unauthorized');

    const traces = await getTraces(params.id, userId);
    return respData(traces);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/chip-compare/records/$id/traces')({
  server: { handlers: { GET } },
});
