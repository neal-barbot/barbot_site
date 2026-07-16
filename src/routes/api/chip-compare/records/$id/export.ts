import { createFileRoute } from '@tanstack/react-router';
import { respErr } from '@/lib/resp';
import { getAuth } from '@/core/auth';
import { exportRecordCsv, getRecord, getTraces } from '@/modules/chip-compare/service';

async function GET({ request, params }: { request: Request; params: { id: string } }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const record = await getRecord(params.id, session.user.id);
    if (!record) return respErr('Record not found');

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') === 'csv' ? 'csv' : 'md';
    const baseName = `chip-compare-${record.id.slice(0, 8)}`;

    if (format === 'csv') {
      const traces = await getTraces(params.id, session.user.id);
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
