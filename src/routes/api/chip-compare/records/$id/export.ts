import { createFileRoute } from '@tanstack/react-router';
import { resolveUserId } from '@/modules/apikeys/auth';
import { respErr } from '@/lib/resp';
import { exportRecordCsv, getRecord, getTraces } from '@/modules/chip-compare/service';

async function GET({ request, params }: { request: Request; params: { id: string } }) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) return respErr('Unauthorized');

    const record = await getRecord(params.id, userId);
    if (!record) return respErr('Record not found');

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') === 'csv' ? 'csv' : 'md';
    const baseName = `chip-compare-${record.id.slice(0, 8)}`;

    if (format === 'csv') {
      const traces = await getTraces(params.id, userId);
      return new Response(exportRecordCsv(traces), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${baseName}.csv"`,
        },
      });
    }

    return new Response(record.result ?? '', {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${baseName}.md"`,
      },
    });
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/chip-compare/records/$id/export')({
  server: { handlers: { GET } },
});
