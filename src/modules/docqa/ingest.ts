import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getSnowId } from '@/lib/hash';
import { envConfigs } from '@/config';
import { ensureWorkspaceDir } from './workspace';
import { putObject } from './storage';

export interface IngestResult {
  docId: string;
  rawKey: string;
  mdKey: string;
  mdPath: string;
}

export async function ingestDocument(userId: string, file: File): Promise<IngestResult> {
  const docId = getSnowId();
  const baseName = path.basename(file.name, path.extname(file.name));
  const bytes = new Uint8Array(await file.arrayBuffer());

  const rawKey = `raw/${userId}/${docId}/${file.name}`;
  await putObject(rawKey, bytes, file.type || 'application/octet-stream');

  const formData = new FormData();
  formData.append('file', new Blob([bytes], { type: file.type }), file.name);

  const mineruRes = await fetch(`${envConfigs.mineru_url}/parse`, {
    method: 'POST',
    body: formData,
  });
  if (!mineruRes.ok) {
    throw new Error(`MinerU parse failed: ${mineruRes.status} ${mineruRes.statusText}`);
  }
  const { markdown } = (await mineruRes.json()) as { markdown: string };

  const mdKey = `md/${userId}/${docId}/${baseName}.md`;
  const mdBytes = new TextEncoder().encode(markdown);
  await putObject(mdKey, mdBytes, 'text/markdown');

  const docsDir = await ensureWorkspaceDir(userId);
  const mdPath = path.join(docsDir, `${docId}-${baseName}.md`);
  await writeFile(mdPath, markdown, 'utf-8');

  return { docId, rawKey, mdKey, mdPath };
}
