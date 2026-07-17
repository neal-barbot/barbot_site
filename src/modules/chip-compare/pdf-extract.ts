import { eq } from 'drizzle-orm';
import { getUuid, md5 } from '@/lib/hash';
import { db } from '@/core/db';
import { pdfParseCache, type PdfParseCache } from '@/config/db/schema';

export interface ExtractedPdf {
  pages: string[];
  pageCount: number;
}

/**
 * Extract per-page text from a PDF buffer using pdfjs (no OCR — text layer only).
 * Throws a descriptive error for scanned/image-only PDFs.
 */
export async function extractPdfText(buffer: Uint8Array): Promise<ExtractedPdf> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: buffer,
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;

  try {
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      pages.push(text);
      page.cleanup();
    }

    const totalChars = pages.reduce((sum, p) => sum + p.length, 0);
    if (totalChars < 50) {
      throw new Error(
        'No extractable text found — this PDF appears to be scanned images without a text layer'
      );
    }

    return { pages, pageCount: doc.numPages };
  } finally {
    await doc.destroy();
  }
}

export interface ParsedPdfContent {
  fileMd5: string;
  fileName: string;
  chipPartNumber: string;
  pages: string[];
  pageCount: number;
}

export function toParsedContent(row: PdfParseCache): ParsedPdfContent {
  return {
    fileMd5: row.fileMd5,
    fileName: row.fileName,
    chipPartNumber: row.chipPartNumber,
    pages: row.pages ? (JSON.parse(row.pages) as string[]) : [],
    pageCount: row.pageCount,
  };
}

export async function getCachedParse(fileMd5: string): Promise<PdfParseCache | null> {
  const [row] = await db()
    .select()
    .from(pdfParseCache)
    .where(eq(pdfParseCache.fileMd5, fileMd5))
    .limit(1);
  return row ?? null;
}

/**
 * Extract text from a PDF buffer and upsert the parse cache row keyed by MD5.
 * Returns the cached row untouched when it already parsed successfully.
 */
export async function parseAndCachePdf(params: {
  buffer: Uint8Array;
  fileName: string;
  chipPartNumber?: string;
  sourceUrl?: string | null;
}): Promise<ParsedPdfContent> {
  const { buffer, fileName, chipPartNumber = '', sourceUrl = null } = params;
  const fileMd5 = md5(buffer);

  const cached = await getCachedParse(fileMd5);
  if (cached?.status === 'success' && cached.pages) {
    return toParsedContent(cached);
  }

  try {
    const { pages, pageCount } = await extractPdfText(buffer);
    const values = {
      fileName,
      chipPartNumber,
      sourceUrl,
      pageCount,
      pages: JSON.stringify(pages),
      status: 'success' as const,
      error: null,
    };

    if (cached) {
      await db().update(pdfParseCache).set(values).where(eq(pdfParseCache.id, cached.id));
    } else {
      await db()
        .insert(pdfParseCache)
        .values({ id: getUuid(), fileMd5, ...values });
    }

    return { fileMd5, fileName, chipPartNumber, pages, pageCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PDF parse failed';
    const failValues = {
      fileName,
      chipPartNumber,
      sourceUrl,
      status: 'failed' as const,
      error: message,
    };
    if (cached) {
      await db().update(pdfParseCache).set(failValues).where(eq(pdfParseCache.id, cached.id));
    } else {
      await db()
        .insert(pdfParseCache)
        .values({ id: getUuid(), fileMd5, pageCount: 0, pages: null, ...failValues });
    }
    throw new Error(`Failed to parse "${fileName}": ${message}`);
  }
}

/**
 * Fetch a datasheet PDF from a URL (catalog chips' sheet_url) and parse it,
 * hitting the cache first via the URL's MD5-of-content once downloaded.
 */
const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;

export async function parsePdfFromUrl(params: {
  url: string;
  fileName?: string;
  chipPartNumber?: string;
}): Promise<ParsedPdfContent> {
  const { url, chipPartNumber = '' } = params;
  const fileName = params.fileName || url.split('/').pop() || 'datasheet.pdf';

  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Unsupported datasheet URL scheme: ${parsed.protocol}`);
  }

  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Failed to download datasheet (${response.status}): ${url}`);
  }
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_DOWNLOAD_BYTES) {
    throw new Error(`Datasheet exceeds the 50MB limit: ${url}`);
  }
  const buffer = new Uint8Array(await response.arrayBuffer());
  if (buffer.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new Error(`Datasheet exceeds the 50MB limit: ${url}`);
  }
  return parseAndCachePdf({ buffer, fileName, chipPartNumber, sourceUrl: url });
}
