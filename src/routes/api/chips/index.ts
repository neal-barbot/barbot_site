import { createFileRoute } from '@tanstack/react-router';
import { respErr, respPage } from '@/lib/resp';
import { searchChips, type SearchMode } from '@/modules/chips/service';

async function GET({ request }: { request: Request }) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || '';
    const mode: SearchMode = searchParams.get('mode') === 'exact' ? 'exact' : 'fuzzy';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '10')));

    const { items, total } = await searchChips({ keyword, mode, page, pageSize });
    return respPage(items, total);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/chips/')({
  server: { handlers: { GET } },
});
