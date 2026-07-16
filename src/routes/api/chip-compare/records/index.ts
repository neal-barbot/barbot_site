import { createFileRoute } from '@tanstack/react-router';
import { respErr, respPage } from '@/lib/resp';
import { getAuth } from '@/core/auth';
import { listRecords } from '@/modules/chip-compare/service';

async function GET({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '10')));

    const { items, total } = await listRecords({ userId: session.user.id, page, pageSize });
    return respPage(items, total);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/chip-compare/records/')({
  server: { handlers: { GET } },
});
