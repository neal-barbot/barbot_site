import path from 'node:path';
import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import { envConfigs } from '@/config';
import { getStorage } from '@/modules/storage/service';
import { createKnowledgeSource, runKnowledgeSyncJob } from '@/modules/ai-support/service';
import { getUuid } from '@/lib/hash';
import { respData, respErr } from '@/lib/resp';

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.txt', '.md', '.markdown', '.csv', '.docx']);

function textContent(file: File, bytes: Uint8Array): Promise<string> {
  const extension = path.extname(file.name).toLowerCase();
  if (['.txt', '.md', '.markdown', '.csv'].includes(extension)) {
    return Promise.resolve(new TextDecoder().decode(bytes));
  }
  if (!envConfigs.mineru_url) {
    return Promise.reject(new Error('Document parsing is not configured'));
  }
  const body = new FormData();
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  body.append('file', new Blob([buffer], { type: file.type || 'application/octet-stream' }), file.name);
  return fetch(`${envConfigs.mineru_url.replace(/\/$/, '')}/parse`, { method: 'POST', body })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Document parsing failed (${response.status})`);
      const parsed = await response.json() as { markdown?: unknown };
      if (typeof parsed.markdown !== 'string' || !parsed.markdown.trim()) {
        throw new Error('Document parsing returned no text');
      }
      return parsed.markdown;
    });
}

async function POST({ request }: { request: Request }) {
  try {
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const formData = await request.formData();
    const chatbotId = formData.get('chatbotId');
    const file = formData.get('file');
    if (typeof chatbotId !== 'string' || !chatbotId) return respErr('chatbotId is required');
    if (!(file instanceof File)) return respErr('file is required');
    if (!file.size || file.size > MAX_FILE_SIZE) return respErr('File must be between 1 byte and 20MB');

    const extension = path.extname(file.name).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(extension)) return respErr('Unsupported file type');

    const bytes = new Uint8Array(await file.arrayBuffer());
    const storage = await getStorage();
    if (!storage) return respErr('File storage is not configured');
    const key = `ai-support/${session.user.id}/${chatbotId}/${getUuid()}${extension}`;
    const upload = await storage.uploadFile({
      key,
      body: bytes,
      contentType: file.type || 'application/octet-stream',
      disposition: 'attachment',
    });
    if (!upload.success) return respErr(upload.error || 'File upload failed');

    const source = await createKnowledgeSource({
      userId: session.user.id,
      chatbotId,
      type: 'file',
      title: file.name.slice(0, 180),
      sourceUrl: upload.url ?? upload.key ?? key,
      metadata: {
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        storageKey: key,
      },
    });

    try {
      const content = await textContent(file, bytes);
      const job = await runKnowledgeSyncJob({ userId: session.user.id, sourceId: source.id, content });
      return respData({ source, job });
    } catch (error) {
      const job = await runKnowledgeSyncJob({
        userId: session.user.id,
        sourceId: source.id,
        error: error instanceof Error ? error.message : 'Document parsing failed',
      });
      return respData({ source, job });
    }
  } catch (error: unknown) {
    return respErr(error instanceof Error ? error.message : 'File upload failed');
  }
}

export const Route = createFileRoute('/api/ai-support/knowledge-upload')({
  server: { handlers: { POST } },
});
