import { createFileRoute } from '@tanstack/react-router';
import fs from 'node:fs/promises';
import path from 'node:path';
import { envConfigs } from '@/config';

/**
 * Serves runtime-generated / uploaded files (EE diagram renders, blog media).
 * Needed in production: nitro only serves the public/ snapshot taken at build
 * time, so files written after the build must go through a route.
 *
 * URLs are extensionless (`/api/files/generated/<basename>`) — the vite dev
 * asset middleware intercepts image-extension paths before the app router.
 * The stored file keeps its real extension; we probe the known set and serve
 * whichever exists, so both PNG diagrams and arbitrary blog images work.
 */
const SAFE_NAME = /^[\w-]+$/;

const EXT_TYPES: Array<[string, string]> = [
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['webp', 'image/webp'],
  ['gif', 'image/gif'],
  ['svg', 'image/svg+xml'],
];

async function GET({ params }: { params: { name: string } }) {
  const name = params.name;
  if (!SAFE_NAME.test(name)) {
    return new Response('Not found', { status: 404 });
  }

  for (const [ext, contentType] of EXT_TYPES) {
    const filePath = path.join(envConfigs.generated_dir, `${name}.${ext}`);
    try {
      const data = await fs.readFile(filePath);
      return new Response(new Uint8Array(data), {
        headers: {
          'Content-Type': contentType,
          // Filenames are UUID-based — content never changes for a given name.
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch {
      // try the next extension
    }
  }
  return new Response('Not found', { status: 404 });
}

export const Route = createFileRoute('/api/files/generated/$name')({
  server: { handlers: { GET } },
});
