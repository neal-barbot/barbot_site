import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { envConfigs } from '@/config';
import { getUuid, md5 } from '@/lib/hash';
import { getStorage } from '@/modules/storage/service';

/**
 * Persist an inline (base64) blog image and return a public URL.
 * Prefers configured object storage (R2/S3 → CDN URL); otherwise writes to
 * GENERATED_DIR and serves via the extensionless /api/files/generated route
 * (works in production, where nitro won't serve runtime-written public/ files).
 */

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB per image

export function decodeBase64Image(data: string): Uint8Array {
  // Accept raw base64 or a data: URL.
  const comma = data.indexOf(',');
  const b64 = data.startsWith('data:') && comma !== -1 ? data.slice(comma + 1) : data;
  const buf = Buffer.from(b64, 'base64');
  if (buf.length === 0) throw new Error('Empty image data');
  if (buf.length > MAX_IMAGE_BYTES) throw new Error('Image exceeds 8 MB');
  return new Uint8Array(buf);
}

export async function persistBlogImage(params: {
  data: string; // base64 or data: URL
  mime: string;
}): Promise<string> {
  const ext = MIME_EXT[params.mime.toLowerCase()];
  if (!ext) throw new Error(`Unsupported image type: ${params.mime}`);

  const body = decodeBase64Image(params.data);
  const basename = `blog-${getUuid()}`;

  // 1. Object storage (R2/S3) if configured → returns a CDN/public URL.
  const storage = await getStorage();
  if (storage) {
    const key = `blog/${basename}.${ext}`;
    const result = await storage.uploadFile({ body, key, contentType: params.mime });
    const url = result.url || storage.getPublicUrl({ key });
    if (url) return url;
  }

  // 2. Local fallback: GENERATED_DIR, served by /api/files/generated/<name>.
  const dir = envConfigs.generated_dir;
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${basename}.${ext}`), body);
  // Extensionless URL — the route probes the stored extension.
  return `/api/files/generated/${basename}`;
}

/** md5 of a base64 payload — for optional dedup logging (not used yet). */
export const imageDigest = (data: string) => md5(data);
