import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/core/db';
import { user } from '@/config/db/schema';
import { getAllConfigs } from '@/modules/config/service';
import { getBalance, grantForNewUser } from '@/modules/credits/service';
import { signPlatformToken, verifyPlatformToken } from './service';

/** Default free DeepSeek models offered on the managed membership relay. */
export const FREE_DEEPSEEK_MODELS = ['deepseek-v4-flash', 'deepseek-v4-pro'] as const;

/**
 * Desktop membership sessions — the platform side of the Harvey (craft-agents)
 * "Membership account" login. Client contract is fixed by the fork's
 * packages/shared/src/auth/barbot.ts:
 *
 *   browser flow:  /auth/desktop?callback=http://127.0.0.1:<port>/barbot/callback
 *                  → user approves → redirect callback?code=<one-time code>
 *                  → POST /api/auth/desktop/exchange { code } → session payload
 *
 * All responses on these endpoints are PLAIN JSON (not the respData envelope).
 */

const ACCESS_TTL_SECONDS = 7 * 24 * 3600; // 7 days
const REFRESH_TTL_SECONDS = 90 * 24 * 3600; // 90 days
const EXCHANGE_CODE_TTL_MS = 5 * 60 * 1000;

export const DESKTOP_PRODUCT_CODES = ['desktop_code', 'craft-agent'];

// --- One-time exchange codes (in-memory, single instance) ---

interface ExchangeCode {
  userId: string;
  expiresAt: number;
}

declare global {
  var __desktopExchangeCodes: Map<string, ExchangeCode> | undefined;
}

function getCodeStore(): Map<string, ExchangeCode> {
  if (!globalThis.__desktopExchangeCodes) {
    globalThis.__desktopExchangeCodes = new Map();
  }
  return globalThis.__desktopExchangeCodes;
}

export function createExchangeCode(userId: string): string {
  const store = getCodeStore();
  const now = Date.now();
  for (const [key, record] of store) {
    if (record.expiresAt < now) store.delete(key);
  }
  const code = randomBytes(32).toString('base64url');
  store.set(code, { userId, expiresAt: now + EXCHANGE_CODE_TTL_MS });
  return code;
}

export function consumeExchangeCode(code: string): string | null {
  const store = getCodeStore();
  const record = store.get(code);
  store.delete(code); // single use, always
  if (!record || record.expiresAt < Date.now()) return null;
  return record.userId;
}

/**
 * Allowed desktop/WebUI callback targets:
 * - loopback (Electron / local callback server)
 * - the public Harvey WebUI host (VITE_HARVEY_URL), for headless agents
 *   behind TLS termination where localhost callbacks are unreachable
 */
export function isLoopbackCallback(callback: string): boolean {
  try {
    const url = new URL(callback);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return true;

    // Remote Harvey WebUI (e.g. https://agent.harveycode.com/barbot/callback)
    const harveyUrl = process.env.VITE_HARVEY_URL?.trim();
    if (harveyUrl && url.protocol === 'https:') {
      try {
        const allowed = new URL(harveyUrl);
        if (url.hostname === allowed.hostname) return true;
      } catch {
        // ignore bad env
      }
    }
    return false;
  } catch {
    return false;
  }
}

// --- Session payloads (shape fixed by the client) ---

export interface DesktopUser {
  id: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
  createdAt: string;
}

export async function getDesktopUser(userId: string): Promise<DesktopUser | null> {
  const [row] = await db().select().from(user).where(eq(user.id, userId)).limit(1);
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? null,
    imageUrl: row.image ?? null,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt ?? ''),
  };
}

export async function buildDesktopSession(userId: string) {
  const desktopUser = await getDesktopUser(userId);
  if (!desktopUser) return null;
  const access = signPlatformToken(userId, 'desktop', ACCESS_TTL_SECONDS);
  const refresh = signPlatformToken(userId, 'desktop_refresh', REFRESH_TTL_SECONDS);
  return {
    token: access.token,
    refreshToken: refresh.token,
    expiresAt: new Date(access.expiresAt * 1000).toISOString(),
    user: desktopUser,
  };
}

export function verifyDesktopBearer(request: Request): { userId: string } | null {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  return verifyPlatformToken(header.slice(7).trim(), 'desktop');
}

export function verifyDesktopRefreshToken(token: string): { userId: string } | null {
  return verifyPlatformToken(token, 'desktop_refresh');
}

// --- Entitlement + provider config ---

/** Legacy shape (BarbotAuthProvider.getEntitlements → /api/entitlements). */
export async function buildLegacyEntitlements(userId: string) {
  const balance = await getBalance(userId);
  return {
    userId,
    plan: 'member',
    products: DESKTOP_PRODUCT_CODES,
    quota: { tokens: 0, used: 0, remaining: 0, credits: balance },
    periodStart: '',
    periodEnd: '',
  };
}

function resolveDeepseekRelay(configs: Record<string, string>) {
  const baseUrl =
    (configs.agent_relay_base_url as string) || 'https://api.deepseek.com/anthropic';
  const apiKey =
    (configs.agent_relay_api_key as string) || process.env.DEEPSEEK_API_KEY || '';
  const modelName = (configs.agent_relay_model as string) || 'deepseek-v4-flash';
  const fromConfig = String(configs.agent_relay_models || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const models = fromConfig.length > 0 ? fromConfig : [...FREE_DEEPSEEK_MODELS];
  if (!models.includes(modelName)) models.unshift(modelName);
  return { baseUrl, apiKey, modelName, models, available: !!apiKey };
}

/**
 * Grant welcome LLM credits once for a user (signup or first desktop authorize).
 * No-op when initial credits are disabled or the user already has a balance.
 */
export async function ensureDesktopLlmQuota(userId: string, userEmail?: string | null) {
  const configs = await getAllConfigs();
  const balance = await getBalance(userId);
  if (balance > 0) return { granted: false, balance };

  await grantForNewUser({
    userId,
    userEmail: userEmail || undefined,
    configs,
  });
  return { granted: true, balance: await getBalance(userId) };
}

/** V1 shape (fetchEntitlementV1 → /api/v1/entitlement, snake_case quota). */
export async function buildEntitlementV1(userId: string, product: string) {
  const configs = await getAllConfigs();
  const relay = resolveDeepseekRelay(configs);
  const balance = await getBalance(userId);
  // DeepSeek managed relay is the free tier — allow even at 0 credits so
  // new members can pick models immediately after login.
  const allowed = relay.available || balance > 0;
  return {
    allowed,
    product,
    plan: relay.available ? 'free' : 'member',
    subscription_status: 'active',
    quota: {
      tokens: 0,
      used_tokens: 0,
      remaining_tokens: 0,
      requests: null,
      remaining_credits: balance,
    },
    features: {
      free_models: relay.available ? relay.models : [],
      allowed_models: relay.available ? relay.models : [],
      default_model: relay.available ? relay.modelName : null,
    },
  };
}

/**
 * Relay channel handed to the client (provider 'anthropic' → the client uses
 * the Claude Agent SDK with baseUrl override — the proven DeepSeek
 * Anthropic-compatible setup). Config-table keys override env defaults.
 *
 * Free tier exposes DeepSeek flash + pro so the model picker has choices.
 */
export async function buildProviderConfig(product: string) {
  const configs = await getAllConfigs();
  const relay = resolveDeepseekRelay(configs);

  if (!relay.available) return { available: false, product, plan: 'free' };

  return {
    available: true,
    product,
    plan: 'free',
    primary: {
      provider: 'anthropic',
      baseUrl: relay.baseUrl,
      apiKey: relay.apiKey,
      modelName: relay.modelName,
    },
    fallbacks: [],
    models: relay.models,
    allowedModels: relay.models,
  };
}
