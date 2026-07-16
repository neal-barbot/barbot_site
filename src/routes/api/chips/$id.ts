import { createFileRoute } from '@tanstack/react-router';
import { respData, respErr } from '@/lib/resp';
import { getChipDetail } from '@/modules/chips/service';

async function GET({ params }: { params: { id: string } }) {
  try {
    const detail = await getChipDetail(params.id);
    if (!detail) return respErr('Chip not found');
    return respData(detail);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/chips/$id')({
  server: { handlers: { GET } },
});
