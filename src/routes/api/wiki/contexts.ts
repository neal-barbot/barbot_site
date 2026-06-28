import { createFileRoute } from '@tanstack/react-router';

import { getAuth } from '@/core/auth';
import { listWikiContexts } from '@/lib/wiki-context';
import { respData, respErr } from '@/lib/resp';

async function GET({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    return respData(await listWikiContexts());
  } catch (error: any) {
    return respErr(error.message || 'Failed to load wiki contexts');
  }
}

export const Route = createFileRoute('/api/wiki/contexts')({
  server: { handlers: { GET } },
});
