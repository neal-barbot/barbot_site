import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import { respData, respErr } from '@/lib/resp';
import { ingestDocument } from '@/modules/docqa/ingest';

async function POST({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return respErr('file field is required');
    if (file.size === 0) return respErr('file is empty');

    const result = await ingestDocument(session.user.id, file);
    return respData(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Ingest failed';
    console.error('[docqa/ingest]', error);
    return respErr(message);
  }
}

export const Route = createFileRoute('/api/docqa/ingest')({
  server: { handlers: { POST } },
});
