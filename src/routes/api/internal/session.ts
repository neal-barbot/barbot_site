import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import { envConfigs } from '@/config';
import { respData, respErr } from '@/lib/resp';

async function GET({ request }: { request: Request }) {
  const token = request.headers.get('x-internal-token');
  if (!token || token !== envConfigs.internal_api_token) {
    return respErr('Unauthorized');
  }

  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('No session');
    return respData({ userId: session.user.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    return respErr(message);
  }
}

export const Route = createFileRoute('/api/internal/session')({
  server: { handlers: { GET } },
});
