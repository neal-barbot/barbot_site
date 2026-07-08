import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import { getAiSupportOverview } from '@/modules/ai-support/service';
import { respData, respErr } from '@/lib/resp';

async function GET({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const overview = await getAiSupportOverview(session.user.id);
    return respData(overview);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/ai-support/overview')({
  server: {
    handlers: { GET },
  },
});
