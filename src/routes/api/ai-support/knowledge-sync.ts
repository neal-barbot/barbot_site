import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import { runKnowledgeSyncJob } from '@/modules/ai-support/service';
import { respData, respErr } from '@/lib/resp';

const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;

function isPrivateAddress(address: string) {
  if (isIP(address) === 4) {
    const [first, second] = address.split('.').map(Number);
    return first === 10 || first === 127 || first === 0 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168);
  }
  const lower = address.toLowerCase();
  return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:');
}

async function assertPublicUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Only http and https URLs are supported');
  if (url.username || url.password || url.port) throw new Error('Credentialed or custom-port URLs are not allowed');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local')) throw new Error('Local URLs are not allowed');
  const records = await lookup(host, { all: true });
  if (!records.length || records.some((record) => isPrivateAddress(record.address))) {
    throw new Error('Private network URLs are not allowed');
  }
  return url;
}

function htmlToText(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 250_000);
}

async function readTextWithLimit(response: Response) {
  const length = Number(response.headers.get('content-length') || 0);
  if (Number.isFinite(length) && length > MAX_DOCUMENT_BYTES) {
    throw new Error('Website response is too large');
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.byteLength;
    if (size > MAX_DOCUMENT_BYTES) {
      await reader.cancel();
      throw new Error('Website response is too large');
    }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function POST({ request }: { request: Request }) {
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');
    const body = await request.json().catch(() => ({}));
    if (typeof body.sourceId !== 'string' || typeof body.url !== 'string') {
      return respErr('sourceId and url are required');
    }

    try {
      const url = await assertPublicUrl(body.url);
      const response = await fetch(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(12_000),
        headers: { 'User-Agent': 'SiteGPT-KnowledgeBot/1.0' },
      });
      if (!response.ok) throw new Error(`Website fetch failed (${response.status})`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
        throw new Error('Website content type is not supported');
      }
      const raw = await readTextWithLimit(response);
      const content = contentType.includes('text/html') ? htmlToText(raw) : raw.slice(0, 250_000).trim();
      if (!content) throw new Error('Website returned no readable text');
      return respData(await runKnowledgeSyncJob({ userId: session.user.id, sourceId: body.sourceId, content }));
    } catch (error) {
      return respData(await runKnowledgeSyncJob({
        userId: session.user.id,
        sourceId: body.sourceId,
        error: error instanceof Error ? error.message : 'Website sync failed',
      }));
    }
  } catch (error: unknown) {
    return respErr(error instanceof Error ? error.message : 'Knowledge sync failed');
  }
}

export const Route = createFileRoute('/api/ai-support/knowledge-sync')({
  server: { handlers: { POST } },
});
