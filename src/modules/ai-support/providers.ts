import { eq } from 'drizzle-orm';
import { db } from '@/core/db';
import { config } from '@/config/db/schema';
import { envConfigs } from '@/config';
import { decryptSecret, isEncryptedSecret } from '@/lib/crypto';
import { assertPublicKnowledgeUrl } from './url-security';

export type KnowledgeSourceProvider = 'native' | 'firecrawl' | 'context_dev';

export interface WebsiteFetchResult {
  content: string;
  pages: number;
  provider: KnowledgeSourceProvider;
}

interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
}

const MAX_CONTENT_LENGTH = 250_000;
const MAX_PAGES = 50;
const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;

export async function readAiSupportConfig(name: string, envName: string): Promise<string> {
  const envValue = typeof process !== 'undefined' ? process.env[envName] : undefined;
  if (envValue?.trim()) return envValue.trim();
  if (!envConfigs.database_url && envConfigs.database_provider !== 'd1') return '';

  const [row] = await db().select({ value: config.value }).from(config).where(eq(config.name, name)).limit(1);
  if (!row?.value) return '';
  return isEncryptedSecret(row.value) ? (await decryptSecret(row.value)) ?? '' : row.value;
}

async function getProviderConfig(provider: Exclude<KnowledgeSourceProvider, 'native'>): Promise<ProviderConfig> {
  if (provider === 'firecrawl') {
    return {
      apiKey: await readAiSupportConfig('firecrawl_api_key', 'AI_SUPPORT_FIRECRAWL_API_KEY'),
      baseUrl: (await readAiSupportConfig('firecrawl_base_url', 'AI_SUPPORT_FIRECRAWL_BASE_URL')) || 'https://api.firecrawl.dev',
    };
  }
  return {
    apiKey: await readAiSupportConfig('context_dev_api_key', 'AI_SUPPORT_CONTEXT_DEV_API_KEY'),
    baseUrl: (await readAiSupportConfig('context_dev_base_url', 'AI_SUPPORT_CONTEXT_DEV_BASE_URL')) || 'https://api.context.dev',
  };
}

function metadataString(metadata: Record<string, unknown>, key: string, fallback: string): string {
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function metadataNumber(metadata: Record<string, unknown>, key: string, fallback: number, max: number): number {
  const value = typeof metadata[key] === 'number' ? Math.floor(metadata[key] as number) : fallback;
  return Math.min(Math.max(value, 1), max);
}

function trimContent(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_CONTENT_LENGTH);
}

async function requestJson(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(45_000) });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const message = typeof payload.error === 'string' ? payload.error : `Provider request failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

async function readTextWithLimit(response: Response): Promise<string> {
  const length = Number(response.headers.get('content-length') || 0);
  if (Number.isFinite(length) && length > MAX_DOCUMENT_BYTES) throw new Error('Website response is too large');
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

function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchNative(url: URL): Promise<WebsiteFetchResult> {
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(12_000),
    headers: { 'User-Agent': 'Barbot-KnowledgeBot/1.0' },
  });
  if (!response.ok) throw new Error(`Website fetch failed (${response.status})`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
    throw new Error('Website content type is not supported');
  }
  const raw = await readTextWithLimit(response);
  const content = trimContent(contentType.includes('text/html') ? htmlToText(raw) : raw);
  if (!content) throw new Error('Website returned no readable text');
  return { content, pages: 1, provider: 'native' };
}

function authHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
}

function markdownFromFirecrawl(payload: Record<string, unknown>): string {
  const data = payload.data && typeof payload.data === 'object' ? payload.data as Record<string, unknown> : payload;
  return typeof data.markdown === 'string' ? data.markdown : '';
}

async function fetchFirecrawl(url: URL, metadata: Record<string, unknown>): Promise<WebsiteFetchResult> {
  const config = await getProviderConfig('firecrawl');
  if (!config.apiKey) throw new Error('Firecrawl API key is not configured');
  const mode = metadataString(metadata, 'mode', 'scrape');
  const headers = authHeaders(config.apiKey);

  if (mode !== 'crawl') {
    const payload = await requestJson(`${config.baseUrl.replace(/\/$/, '')}/v2/scrape`, {
      method: 'POST', headers, body: JSON.stringify({ url: url.toString(), formats: ['markdown'], onlyMainContent: true }),
    });
    const content = trimContent(markdownFromFirecrawl(payload));
    if (!content) throw new Error('Firecrawl returned no Markdown content');
    return { content, pages: 1, provider: 'firecrawl' };
  }

  const started = await requestJson(`${config.baseUrl.replace(/\/$/, '')}/v2/crawl`, {
    method: 'POST', headers,
    body: JSON.stringify({
      url: url.toString(),
      limit: metadataNumber(metadata, 'maxPages', 10, MAX_PAGES),
      maxDiscoveryDepth: metadataNumber(metadata, 'maxDepth', 2, 5),
      scrapeOptions: { formats: ['markdown'], onlyMainContent: true },
    }),
  });
  const jobId = typeof started.id === 'string' ? started.id : '';
  if (!jobId) throw new Error('Firecrawl did not return a crawl job id');

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await requestJson(`${config.baseUrl.replace(/\/$/, '')}/v2/crawl/${encodeURIComponent(jobId)}`, { headers });
    const status = typeof result.status === 'string' ? result.status : '';
    if (status === 'completed') {
      const rows = Array.isArray(result.data) ? result.data : [];
      const content = trimContent(rows.map((row) => {
        const item = row && typeof row === 'object' ? row as Record<string, unknown> : {};
        return markdownFromFirecrawl(item);
      }).filter(Boolean).join('\n\n---\n\n'));
      if (!content) throw new Error('Firecrawl crawl returned no Markdown content');
      return { content, pages: rows.length, provider: 'firecrawl' };
    }
    if (status === 'failed' || status === 'cancelled') throw new Error(`Firecrawl crawl ${status}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Firecrawl crawl timed out');
}

async function fetchContextDev(url: URL, metadata: Record<string, unknown>): Promise<WebsiteFetchResult> {
  const config = await getProviderConfig('context_dev');
  if (!config.apiKey) throw new Error('Context.dev API key is not configured');
  const baseUrl = config.baseUrl.replace(/\/$/, '');
  const headers = authHeaders(config.apiKey);
  const mode = metadataString(metadata, 'mode', 'scrape');

  if (mode !== 'crawl') {
    const endpoint = `${baseUrl}/v1/scrape/markdown?url=${encodeURIComponent(url.toString())}`;
    const payload = await requestJson(endpoint, { method: 'GET', headers });
    const content = trimContent(typeof payload.markdown === 'string' ? payload.markdown : '');
    if (!content) throw new Error('Context.dev returned no Markdown content');
    return { content, pages: 1, provider: 'context_dev' };
  }

  const payload = await requestJson(`${baseUrl}/v1/web/crawl`, {
    method: 'POST', headers,
    body: JSON.stringify({
      url: url.toString(),
      maxDepth: metadataNumber(metadata, 'maxDepth', 2, 5),
      maxPages: metadataNumber(metadata, 'maxPages', 10, MAX_PAGES),
      followSubdomains: metadata.followSubdomains === true,
      urlRegex: typeof metadata.urlRegex === 'string' ? metadata.urlRegex.slice(0, 500) : undefined,
    }),
  });
  const rows = Array.isArray(payload.results) ? payload.results : [];
  const content = trimContent(rows.map((row) => {
    const item = row && typeof row === 'object' ? row as Record<string, unknown> : {};
    return typeof item.markdown === 'string' ? item.markdown : '';
  }).filter(Boolean).join('\n\n---\n\n'));
  if (!content) throw new Error('Context.dev crawl returned no Markdown content');
  return { content, pages: rows.length, provider: 'context_dev' };
}

export async function fetchWebsiteKnowledge(input: {
  url: string;
  metadata?: Record<string, unknown>;
}): Promise<WebsiteFetchResult> {
  const url = await assertPublicKnowledgeUrl(input.url);
  const metadata = input.metadata ?? {};
  const provider = metadataString(metadata, 'provider', 'native') as KnowledgeSourceProvider;
  if (provider === 'firecrawl') return fetchFirecrawl(url, metadata);
  if (provider === 'context_dev') return fetchContextDev(url, metadata);
  return fetchNative(url);
}
