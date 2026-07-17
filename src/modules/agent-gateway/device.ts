import { randomBytes } from 'node:crypto';
import { create as createApiKey } from '@/modules/apikeys/service';

/**
 * OAuth-style Device Authorization Flow (RFC 8628 shape) for CLI / agent
 * onboarding — the "sign in with Barbot" step:
 *
 *   1. Client:  POST /api/agent/device/code            → userCode + deviceCode
 *   2. User:    opens /settings/device?code=<userCode>, signs in, approves
 *   3. Client:  polls POST /api/agent/device/token      → API key (once)
 *
 * The issued credential is a regular platform API key (apikeys module), so
 * revocation and listing work from the existing /settings/apikeys UI.
 *
 * Store is in-memory (single-instance dev/deploy). Codes live 10 minutes and
 * the API key is handed to the poller exactly once.
 */

const CODE_TTL_MS = 10 * 60 * 1000;
const MIN_POLL_INTERVAL_MS = 3000;

export interface DeviceAuthorization {
  deviceCode: string;
  userCode: string;
  status: 'pending' | 'approved' | 'denied';
  userId?: string;
  apiKey?: string;
  createdAt: number;
  expiresAt: number;
  lastPollAt: number;
}

type DeviceStore = Map<string, DeviceAuthorization>;

declare global {
  var __agentDeviceAuthStore: DeviceStore | undefined;
}

function getStore(): DeviceStore {
  if (!globalThis.__agentDeviceAuthStore) {
    globalThis.__agentDeviceAuthStore = new Map();
  }
  return globalThis.__agentDeviceAuthStore;
}

function sweepExpired(store: DeviceStore) {
  const now = Date.now();
  for (const [key, record] of store) {
    if (record.expiresAt < now) store.delete(key);
  }
}

// Crockford-ish alphabet: no 0/O/1/I ambiguity on the pairing code.
const USER_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

function generateUserCode(): string {
  const bytes = randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += USER_CODE_ALPHABET[bytes[i] % USER_CODE_ALPHABET.length];
    if (i === 3) code += '-';
  }
  return code;
}

export function createDeviceAuthorization(): {
  deviceCode: string;
  userCode: string;
  expiresIn: number;
  interval: number;
} {
  const store = getStore();
  sweepExpired(store);

  const deviceCode = randomBytes(32).toString('base64url');
  let userCode = generateUserCode();
  while ([...store.values()].some((r) => r.userCode === userCode)) {
    userCode = generateUserCode();
  }

  const now = Date.now();
  store.set(deviceCode, {
    deviceCode,
    userCode,
    status: 'pending',
    createdAt: now,
    expiresAt: now + CODE_TTL_MS,
    lastPollAt: 0,
  });

  return {
    deviceCode,
    userCode,
    expiresIn: Math.floor(CODE_TTL_MS / 1000),
    interval: Math.floor(MIN_POLL_INTERVAL_MS / 1000),
  };
}

export function findByUserCode(userCode: string): DeviceAuthorization | null {
  const store = getStore();
  sweepExpired(store);
  const normalized = userCode.trim().toUpperCase();
  for (const record of store.values()) {
    if (record.userCode === normalized) return record;
  }
  return null;
}

/**
 * Approve a pending pairing: mints a real API key owned by the approving
 * user and parks it on the record for the poller to collect.
 */
export async function approveDevice(params: {
  userCode: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const record = findByUserCode(params.userCode);
  if (!record) return { ok: false, error: 'code_not_found_or_expired' };
  if (record.status !== 'pending') return { ok: false, error: 'already_processed' };

  const { key } = await createApiKey({
    userId: params.userId,
    title: `Agent device login (${record.userCode})`,
  });

  const store = getStore();
  store.set(record.deviceCode, {
    ...record,
    status: 'approved',
    userId: params.userId,
    apiKey: key,
  });
  return { ok: true };
}

export function denyDevice(userCode: string): boolean {
  const record = findByUserCode(userCode);
  if (!record || record.status !== 'pending') return false;
  getStore().set(record.deviceCode, { ...record, status: 'denied' });
  return true;
}

export type PollResult =
  | { status: 'pending' }
  | { status: 'slow_down' }
  | { status: 'denied' }
  | { status: 'expired' }
  | { status: 'approved'; apiKey: string; userId: string };

/**
 * Client polling. On success the API key is returned exactly once and the
 * record is destroyed.
 */
export function pollDevice(deviceCode: string): PollResult {
  const store = getStore();
  const record = store.get(deviceCode);
  if (!record || record.expiresAt < Date.now()) {
    if (record) store.delete(deviceCode);
    return { status: 'expired' };
  }

  const now = Date.now();
  if (now - record.lastPollAt < MIN_POLL_INTERVAL_MS) {
    return { status: 'slow_down' };
  }
  store.set(deviceCode, { ...record, lastPollAt: now });

  if (record.status === 'denied') {
    store.delete(deviceCode);
    return { status: 'denied' };
  }
  if (record.status === 'approved' && record.apiKey && record.userId) {
    store.delete(deviceCode);
    return { status: 'approved', apiKey: record.apiKey, userId: record.userId };
  }
  return { status: 'pending' };
}
