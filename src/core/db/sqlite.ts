import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

import type { DbConfig } from './types';

const isCloudflareWorker =
  typeof globalThis !== 'undefined' && 'Cloudflare' in globalThis;

// SQLite/libsql singleton
let sqliteDbInstance: ReturnType<typeof drizzle> | null = null;

/**
 * Local-file SQLite is shared by multiple processes (dev server + agent-task
 * worker). WAL allows a reader and a writer to coexist; busy_timeout makes
 * writers wait instead of failing with SQLITE_BUSY. No-op on remote turso
 * URLs (fire-and-forget, errors ignored).
 */
function tunePragmas(client: Client, url: string) {
  if (!url.startsWith('file:')) return;
  client.execute('PRAGMA journal_mode = WAL').catch(() => {});
  client.execute('PRAGMA busy_timeout = 5000').catch(() => {});
}

export function createSqliteDb(config: DbConfig) {
  const databaseUrl = config.database_url;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const options: Record<string, string> = {};
  if (config.database_auth_token) {
    options.authToken = config.database_auth_token;
  }

  // In Cloudflare Workers, create new connection each time
  if (isCloudflareWorker) {
    const client = createClient({
      url: databaseUrl,
      ...options,
    });
    return drizzle({ client });
  }

  // Local-file databases ALWAYS reuse one client per process: the libsql
  // binding blocks the event loop synchronously while waiting on locks, so a
  // second in-process connection deadlocks against an open write transaction
  // (guaranteed SQLITE_BUSY after busy_timeout). Remote turso URLs keep the
  // db_singleton_enabled opt-in.
  if (databaseUrl.startsWith('file:') || config.db_singleton_enabled === 'true') {
    if (sqliteDbInstance) return sqliteDbInstance;

    const client = createClient({
      url: databaseUrl,
      ...options,
    });
    tunePragmas(client, databaseUrl);
    sqliteDbInstance = drizzle({ client });
    return sqliteDbInstance;
  }

  // Non-singleton mode: create new connection each time
  const client = createClient({
    url: databaseUrl,
    ...options,
  });
  tunePragmas(client, databaseUrl);
  return drizzle({ client });
}
