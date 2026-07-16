import { createFileRoute } from '@tanstack/react-router';
import { md5 } from '@/lib/hash';
import { respData, respErr } from '@/lib/resp';
import { getAuth } from '@/core/auth';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { getStorage } from '@/modules/storage/service';
import { getCachedParse, parseAndCachePdf } from '@/modules/chip-compare/pdf-extract';

const MAX_FILES = 10;
const MAX_FILE_BYTES = 50 * 1024 * 1024;

interface UploadedPdf {
  fileMd5: string;
  fileName: string;
  pageCount: number;
  cached: boolean;
}

async function POST({ request }: { request: Request }) {
  const limited = enforceMinIntervalRateLimit(request, {
    intervalMs: 2000,
    keyPrefix: 'chip-pdf-upload',
  });
  if (limited) return limited;

  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    if (!files.length) return respErr('No files provided');
    if (files.length > MAX_FILES) return respErr(`At most ${MAX_FILES} files per upload`);

    const storage = await getStorage();
    const results: UploadedPdf[] = [];

    for (const file of files) {
      const isPdf =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) return respErr(`File ${file.name} is not a PDF`);
      if (file.size > MAX_FILE_BYTES) {
        return respErr(`File ${file.name} exceeds the 50MB limit`);
      }

      const body = new Uint8Array(await file.arrayBuffer());
      const fileMd5 = md5(body);

      const existing = await getCachedParse(fileMd5);
      if (existing?.status === 'success' && existing.pages) {
        results.push({
          fileMd5,
          fileName: file.name,
          pageCount: existing.pageCount,
          cached: true,
        });
        continue;
      }

      // Keep the original PDF when object storage is configured (optional).
      let sourceUrl: string | null = null;
      if (storage) {
        try {
          const uploaded = await storage.uploadFile({
            body,
            key: `chip-pdfs/${fileMd5}.pdf`,
            contentType: 'application/pdf',
            disposition: 'inline',
          });
          sourceUrl = uploaded.url ?? null;
        } catch {
          sourceUrl = null;
        }
      }

      const parsed = await parseAndCachePdf({
        buffer: body,
        fileName: file.name,
        sourceUrl,
      });
      results.push({
        fileMd5: parsed.fileMd5,
        fileName: file.name,
        pageCount: parsed.pageCount,
        cached: false,
      });
    }

    return respData({ files: results });
  } catch (error: any) {
    console.error('Chip PDF upload failed:', error);
    return respErr(error.message || 'Upload failed');
  }
}

export const Route = createFileRoute('/api/chip-compare/upload')({
  server: { handlers: { POST } },
});
