import { createFileRoute } from '@tanstack/react-router';

import { getAuth } from '@/core/auth';
import { readWikiContext } from '@/lib/wiki-context';
import { respData, respErr } from '@/lib/resp';

async function GET({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return respErr('Context id is required');

    return respData(await readWikiContext(id));
  } catch (error: any) {
    return respErr(error.message || 'Failed to load wiki context');
  }
}

export const Route = createFileRoute('/api/wiki/context')({
  server: { handlers: { GET } },
});
