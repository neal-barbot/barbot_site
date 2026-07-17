import { and, eq } from 'drizzle-orm';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { db } from '@/core/db';
import { credit } from '@/config/db/schema';
import { envConfigs } from '@/config';
import { getAllConfigs } from '@/modules/config/service';
import {
  consume,
  getBalance,
  CreditTransactionType,
} from '@/modules/credits/service';

/**
 * Agent gateway — the thin platform contract for external agent executors
 * (OSS agent servers, CLI runners). Mirrors the OpenAI-platform shape:
 *
 *   1. Token issuance   POST /api/agent/token    (user auth → short-lived JWT)
 *   2. Usage reporting  POST /api/internal/usage (service auth, idempotent)
 *   3. Balance check    GET  /api/internal/balance
 *
 * Executors verify the JWT offline: HS256 over `header.payload` with
 * AGENT_JWT_SECRET (falls back to AUTH_SECRET), claims { iss: 'barbot',
 * sub: <userId>, scope: 'agent', iat, exp }.
 *
 * Note: this module depends on credits/ for billing, the same documented
 * exception as payment/ and ai-tasks/.
 */

// --- JWT (HS256, no external deps) ---

const TOKEN_TTL_SECONDS = 900; // 15 minutes — executors re-exchange as needed

function getJwtSecret(): string {
  const secret = envConfigs.agent_jwt_secret || envConfigs.auth_secret;
  if (!secret) throw new Error('AGENT_JWT_SECRET / AUTH_SECRET not configured');
  return secret;
}

const b64url = (value: string) => Buffer.from(value).toString('base64url');

/** Sign a platform JWT with an explicit scope + TTL (HS256). */
export function signPlatformToken(
  userId: string,
  scope: string,
  ttlSeconds: number
): { token: string; expiresAt: number } {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + ttlSeconds;
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({ iss: 'barbot', sub: userId, scope, iat: now, exp: expiresAt })
  );
  const signature = createHmac('sha256', getJwtSecret())
    .update(`${header}.${payload}`)
    .digest('base64url');
  return { token: `${header}.${payload}.${signature}`, expiresAt };
}

/** Verify a platform JWT and require the given scope. */
export function verifyPlatformToken(token: string, scope: string): { userId: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = createHmac('sha256', getJwtSecret())
    .update(`${header}.${payload}`)
    .digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      iss?: string;
      sub?: string;
      scope?: string;
      exp?: number;
    };
    if (claims.iss !== 'barbot' || claims.scope !== scope || !claims.sub) return null;
    if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) return null;
    return { userId: claims.sub };
  } catch {
    return null;
  }
}

export function signAgentToken(userId: string): { token: string; expiresAt: number } {
  return signPlatformToken(userId, 'agent', TOKEN_TTL_SECONDS);
}

export function verifyAgentToken(token: string): { userId: string } | null {
  return verifyPlatformToken(token, 'agent');
}

// --- Scene pricing (config table with env-style fallbacks) ---

export const USAGE_SCENES = ['chip_compare', 'ai_fae_answer', 'agent_task'] as const;
export type UsageScene = (typeof USAGE_SCENES)[number];

const SCENE_PRICING: Record<UsageScene, { configKey: string; fallback: number }> = {
  chip_compare: { configKey: 'chip_compare_cost_credits', fallback: 10 },
  ai_fae_answer: { configKey: 'ai_fae_cost_credits', fallback: 1 },
  agent_task: { configKey: 'agent_task_cost_credits', fallback: 5 },
};

export async function getSceneUnitCost(scene: UsageScene): Promise<number> {
  const { configKey, fallback } = SCENE_PRICING[scene];
  const configs = await getAllConfigs();
  const raw = Number.parseInt((configs[configKey] as string) || '', 10);
  return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
}

// --- Usage recording (idempotent via externalId) ---

export interface UsageResult {
  duplicate: boolean;
  deducted: boolean;
  credits: number;
  balance: number;
}

/**
 * Deduct credits for a completed unit of agent work. Idempotent: a repeated
 * externalId (per user + scene) returns the original outcome without a
 * second deduction, so executors can safely retry on network failures.
 */
export async function recordUsage(params: {
  userId: string;
  scene: UsageScene;
  units: number;
  externalId: string;
  description?: string;
}): Promise<UsageResult & { error?: string }> {
  const { userId, scene, units, externalId, description } = params;
  const metadata = JSON.stringify({ externalId });

  const [existing] = await db()
    .select({ id: credit.id, credits: credit.credits })
    .from(credit)
    .where(
      and(
        eq(credit.userId, userId),
        eq(credit.transactionType, CreditTransactionType.CONSUME),
        eq(credit.transactionScene, scene),
        eq(credit.metadata, metadata)
      )
    )
    .limit(1);

  if (existing) {
    return {
      duplicate: true,
      deducted: true,
      credits: Math.abs(existing.credits),
      balance: await getBalance(userId),
    };
  }

  const unitCost = await getSceneUnitCost(scene);
  const total = unitCost * units;
  if (total <= 0) {
    return { duplicate: false, deducted: false, credits: 0, balance: await getBalance(userId) };
  }

  const result = await consume({
    userId,
    credits: total,
    scene,
    description: description || `Agent usage: ${scene} × ${units}`,
    metadata,
  });

  if (!result.success) {
    return {
      duplicate: false,
      deducted: false,
      credits: total,
      balance: await getBalance(userId),
      error: 'insufficient_credits',
    };
  }

  return { duplicate: false, deducted: true, credits: total, balance: await getBalance(userId) };
}

// --- Service auth helper for /api/internal/* ---

export function verifyInternalToken(request: Request): boolean {
  const token = request.headers.get('x-internal-token') || '';
  const expected = envConfigs.internal_api_token;
  if (!token || !expected) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
