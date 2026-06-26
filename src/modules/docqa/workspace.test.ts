import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/config', () => ({
  envConfigs: { workspaces_root: '' },
}));

import { envConfigs } from '@/config';
import { workspaceIdFor, workspaceDir, ensureWorkspaceDir, assertOwnedWorkspace } from './workspace';

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'docqa-test-'));
  (envConfigs as Record<string, string>).workspaces_root = tmpRoot;
});

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

describe('workspaceIdFor', () => {
  it('prefixes with u_', () => {
    expect(workspaceIdFor('abc')).toBe('u_abc');
  });
  it('throws on empty userId', () => {
    expect(() => workspaceIdFor('')).toThrow('userId required');
  });
});

describe('assertOwnedWorkspace', () => {
  it('passes when ids match', () => {
    expect(() => assertOwnedWorkspace('abc', 'u_abc')).not.toThrow();
  });
  it('throws when ids do not match', () => {
    expect(() => assertOwnedWorkspace('abc', 'u_xyz')).toThrow('workspace not owned by user');
  });
});

describe('ensureWorkspaceDir', () => {
  it('creates the docs dir and returns its path', async () => {
    const { existsSync } = await import('node:fs');
    const docsPath = await ensureWorkspaceDir('user1');
    expect(docsPath).toBe(path.join(tmpRoot, 'u_user1', 'docs'));
    expect(existsSync(docsPath)).toBe(true);
  });

  it('is idempotent (no error on second call)', async () => {
    await ensureWorkspaceDir('user2');
    await expect(ensureWorkspaceDir('user2')).resolves.toBeDefined();
  });
});
