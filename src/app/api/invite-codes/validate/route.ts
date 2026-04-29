import { respData, respErr } from '@/lib/resp';
import { validateInviteCode } from '@/modules/invite-codes/service';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const code = String(body?.code || '').trim();
    if (!code) return respErr('Invite code is required');

    const result = await validateInviteCode(code);
    if (!result.valid) {
      return respErr(result.error || 'Invalid invite code');
    }

    return respData({ valid: true, trialDays: result.trialDays });
  } catch (e: any) {
    console.log('validate invite code failed:', e);
    return respErr(e?.message || 'Validation failed');
  }
}
