import { createFileRoute } from '@tanstack/react-router';
import fs from 'node:fs/promises';
import path from 'node:path';
import { envConfigs } from '@/config';

/**
 * Serves runtime-generated images (EE diagram renders). Needed in
 * production: nitro only serves the public/ snapshot taken at build time,
 * so files written after the build must go through a route.
 *
 * URLs are extensionless (`/api/files/generated/<basename>`) — the vite dev
 * asset middleware intercepts image-extension paths before the app router,
 * and the stored files are always PNG anyway.
 */
const SAFE_NAME = /^[\w-]+$/;

async function GET({ params }: { params: { name: string } }) {
  const name = params.name;
  if (!SAFE_NAME.test(name)) {
    return new Response('Not found', { status: 404 });
  }

  const filePath = path.join(envConfigs.generated_dir, `${name}.png`);
  try {
    const data = await fs.readFile(filePath);
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': 'image/png',
        // Filenames are UUID-based — content never changes for a given name.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

export const Route = createFileRoute('/api/files/generated/$name')({
  server: { handlers: { GET } },
});
