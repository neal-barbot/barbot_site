/**
 * Barbot Agent SDK — zero-dependency client for the Barbot platform contract.
 * Node 18+ (built-in fetch). Single file: copy it into any agent project.
 *
 * Two roles:
 *
 * 1. USER-SIDE (a CLI / agent acting on behalf of a user):
 *
 *    import { BarbotClient } from './barbot-agent-sdk.mjs';
 *
 *    // First run — OAuth-style device login (like `codex login`):
 *    const client = await BarbotClient.deviceLogin({
 *      baseUrl: 'https://barbot.example.com',
 *      onPrompt: ({ verificationUriComplete, userCode }) =>
 *        console.log(`Open ${verificationUriComplete} and approve code ${userCode}`),
 *    });
 *    console.log('API key (store it):', client.apiKey);
 *
 *    // Later runs — reuse the stored key:
 *    const client = new BarbotClient({ baseUrl, apiKey: process.env.BARBOT_API_KEY });
 *    const { token, balance } = await client.getAgentToken(); // short-lived JWT
 *
 * 2. EXECUTOR-SIDE (an OSS agent server verifying users + reporting usage):
 *
 *    import { verifyAgentToken, BarbotServiceClient } from './barbot-agent-sdk.mjs';
 *
 *    const claims = verifyAgentToken(jwtFromBrowser, process.env.AGENT_JWT_SECRET);
 *    if (!claims) return reject401();
 *
 *    const svc = new BarbotServiceClient({ baseUrl, internalToken: process.env.INTERNAL_API_TOKEN });
 *    const { sufficient } = await svc.checkBalance({ userId: claims.userId, scene: 'agent_task' });
 *    // ... run the task ...
 *    await svc.reportUsage({ userId: claims.userId, scene: 'agent_task', units: 1, externalId: taskId });
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function apiFetch(url, { headers = {}, ...init } = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Barbot API non-JSON response (${response.status}): ${text.slice(0, 200)}`);
  }
  if (json.code !== 0) throw new Error(json.message || `Barbot API error (${response.status})`);
  return json.data;
}

// ---------------------------------------------------------------------------
// User-side client
// ---------------------------------------------------------------------------

export class BarbotClient {
  /** @param {{ baseUrl: string, apiKey: string }} options */
  constructor({ baseUrl, apiKey }) {
    if (!baseUrl) throw new Error('baseUrl required');
    if (!apiKey) throw new Error('apiKey required (run BarbotClient.deviceLogin first)');
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this._token = null; // { token, expiresAt (unix seconds), userId, balance }
  }

  /**
   * OAuth-style device authorization: prints/asks the user to approve in the
   * browser, polls until approved, returns a ready client. Persist
   * `client.apiKey` yourself (env, keychain, config file).
   *
   * @param {{ baseUrl: string, onPrompt?: (grant: any) => void, timeoutMs?: number }} options
   */
  static async deviceLogin({ baseUrl, onPrompt, timeoutMs = 10 * 60 * 1000 }) {
    const base = baseUrl.replace(/\/$/, '');
    const grant = await apiFetch(`${base}/api/agent/device/code`, { method: 'POST' });
    (onPrompt ?? ((g) => {
      console.log(`\nTo sign in, open:\n\n  ${g.verificationUriComplete}\n\nand approve pairing code ${g.userCode}\n`);
    }))(grant);

    const deadline = Date.now() + Math.min(timeoutMs, grant.expiresIn * 1000);
    let intervalMs = Math.max(grant.interval * 1000, 3000);
    while (Date.now() < deadline) {
      await sleep(intervalMs);
      const result = await apiFetch(`${base}/api/agent/device/token`, {
        method: 'POST',
        body: JSON.stringify({ deviceCode: grant.deviceCode }),
      });
      if (result.status === 'approved') {
        return new BarbotClient({ baseUrl: base, apiKey: result.apiKey });
      }
      if (result.status === 'denied') throw new Error('Device login denied by user');
      if (result.status === 'expired') throw new Error('Device login expired — start again');
      if (result.status === 'slow_down') intervalMs += 2000;
    }
    throw new Error('Device login timed out');
  }

  /**
   * Short-lived platform JWT (15 min), cached and auto-refreshed 60s before
   * expiry. Hand this to web UIs / executors that verify offline.
   */
  async getAgentToken() {
    const now = Math.floor(Date.now() / 1000);
    if (this._token && this._token.expiresAt - now > 60) return this._token;
    this._token = await apiFetch(`${this.baseUrl}/api/agent/token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    return this._token;
  }

  /** Authenticated call to any platform API (Bearer = the stored API key). */
  async request(path, init = {}) {
    return apiFetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.apiKey}`, ...(init.headers ?? {}) },
    });
  }
}

// ---------------------------------------------------------------------------
// Executor-side: offline JWT verification + service client
// ---------------------------------------------------------------------------

/**
 * Verify a Barbot agent JWT offline (HS256, shared secret). Returns
 * `{ userId }` or null. Mirrors the platform's verifyAgentToken.
 */
export function verifyAgentToken(token, secret) {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest();
  let actual;
  try {
    actual = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (claims.iss !== 'barbot' || claims.scope !== 'agent' || !claims.sub) return null;
    if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) return null;
    return { userId: claims.sub };
  } catch {
    return null;
  }
}

export class BarbotServiceClient {
  /** @param {{ baseUrl: string, internalToken: string }} options */
  constructor({ baseUrl, internalToken }) {
    if (!baseUrl) throw new Error('baseUrl required');
    if (!internalToken) throw new Error('internalToken required');
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.internalToken = internalToken;
  }

  /**
   * Pre-flight affordability check.
   * @param {{ userId: string, scene?: 'chip_compare'|'ai_fae_answer'|'agent_task', units?: number }} params
   * @returns {Promise<{ balance: number, unitCost?: number, required?: number, sufficient?: boolean }>}
   */
  async checkBalance({ userId, scene, units = 1 }) {
    const query = new URLSearchParams({ userId });
    if (scene) {
      query.set('scene', scene);
      query.set('units', String(units));
    }
    return apiFetch(`${this.baseUrl}/api/internal/balance?${query}`, {
      headers: { 'x-internal-token': this.internalToken },
    });
  }

  /**
   * Report completed work. Idempotent on externalId — safe to retry.
   * @param {{ userId: string, scene: string, units?: number, externalId: string, description?: string }} params
   * @returns {Promise<{ duplicate: boolean, deducted: boolean, credits: number, balance: number }>}
   */
  async reportUsage({ userId, scene, units = 1, externalId, description }) {
    return apiFetch(`${this.baseUrl}/api/internal/usage`, {
      method: 'POST',
      headers: { 'x-internal-token': this.internalToken },
      body: JSON.stringify({ userId, scene, units, externalId, description }),
    });
  }
}
