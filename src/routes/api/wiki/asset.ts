import { createFileRoute } from '@tanstack/react-router';

import { readWikiAsset } from '@/lib/wiki-context';
import { respErr } from '@/lib/resp';

async function GET({ request }: { request: Request }) {
  try {
    const url = new URL(request.url);
    const contextId = url.searchParams.get('contextId') || '';
    const name = url.searchParams.get('name') || '';
    if (!contextId || !name) return respErr('Missing asset params');

    const asset = await readWikiAsset({ contextId, name });
    return new Response(asset.bytes, {
      headers: {
        'content-type': asset.contentType,
        'cache-control': 'private, max-age=300',
      },
    });
  } catch (error: any) {
    return respErr(error.message || 'Failed to load wiki asset');
  }
}

export const Route = createFileRoute('/api/wiki/asset')({
  server: { handlers: { GET } },
});
