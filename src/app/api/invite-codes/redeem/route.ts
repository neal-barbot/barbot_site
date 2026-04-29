import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { respData, respErr } from '@/lib/resp';
import { getAuth } from '@/core/auth';
import { db } from '@/core/db';
import { userInvite } from '@/config/db/schema';
import { validateInviteCode, redeemInviteCode } from '@/modules/invite-codes/service';

export async function POST(req: Request) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return respErr('Unauthorized');

    const body = await req.json().catch(() => ({}));
    const code = String(body?.code || '').trim();
    if (!code) return respErr('Invite code is required');

    // Already redeemed for this user → idempotent success.
    const [existing] = await db()
      .select()
      .from(userInvite)
      .where(eq(userInvite.userId, session.user.id))
      .limit(1);
    if (existing) {
      return respData({ trialEndsAt: existing.trialEndsAt });
    }

    const result = await validateInviteCode(code);
    if (!result.valid || !result.inviteCodeId || result.trialDays === undefined) {
      return respErr(result.error || 'Invalid invite code');
    }

    const { trialEndsAt } = await redeemInviteCode({
      userId: session.user.id,
      inviteCodeId: result.inviteCodeId,
      trialDays: result.trialDays,
    });

    return respData({ trialEndsAt });
  } catch (e: any) {
    console.log('redeem invite code failed:', e);
    return respErr(e?.message || 'Redeem failed');
  }
}
