import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { envConfigs } from '@/config';

export function workspaceIdFor(userId: string): string {
  if (!userId) throw new Error('userId required');
  return `u_${userId}`;
}

export function workspaceDir(userId: string): string {
  return path.join(envConfigs.workspaces_root, workspaceIdFor(userId));
}

export async function ensureWorkspaceDir(userId: string): Promise<string> {
  const docs = path.join(workspaceDir(userId), 'docs');
  await mkdir(docs, { recursive: true });
  return docs;
}

export function assertOwnedWorkspace(userId: string, workspaceId: string): void {
  if (workspaceId !== workspaceIdFor(userId)) {
    throw new Error('workspace not owned by user');
  }
}
