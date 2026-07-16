import { createFileRoute } from '@tanstack/react-router';
import { resolveUserId } from '@/modules/apikeys/auth';
import { respErr, respPage } from '@/lib/resp';
import { listRecords } from '@/modules/chip-compare/service';

async function GET({ request }: { request: Request }) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) return respErr('Unauthorized');

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '10')));

    const { items, total } = await listRecords({ userId: userId, page, pageSize });
    return respPage(items, total);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/chip-compare/records/')({
  server: { handlers: { GET } },
});
