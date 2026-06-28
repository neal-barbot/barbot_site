import { createFileRoute } from '@tanstack/react-router';

import { getAuth } from '@/core/auth';
import { askWiki } from '@/lib/wiki-context';
import { respData, respErr } from '@/lib/resp';

async function POST({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const body = await request.json();
    const question = String(body.question || '').trim();
    const contextIds = Array.isArray(body.contextIds) ? body.contextIds.map(String) : [];
    const selection =
      body.selection && typeof body.selection === 'object'
        ? {
            x: Number(body.selection.x) || 0,
            y: Number(body.selection.y) || 0,
            width: Number(body.selection.width) || 0,
            height: Number(body.selection.height) || 0,
          }
        : null;

    if (!question) return respErr('Question is required');

    return respData(await askWiki({
      question,
      contextIds,
      focus: {
        imageName: body.imageName ? String(body.imageName) : undefined,
        mode: body.mode ? String(body.mode) : 'diagram_focus',
        selection,
      },
    }));
  } catch (error: any) {
    return respErr(error.message || 'Failed to ask wiki');
  }
}

export const Route = createFileRoute('/api/wiki/ask')({
  server: { handlers: { POST } },
});
