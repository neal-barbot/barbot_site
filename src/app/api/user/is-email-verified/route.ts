import { eq } from 'drizzle-orm';
import { respData, respErr } from '@/lib/resp';
import { db } from '@/core/db';
import { user } from '@/config/db/schema';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    if (!email) {
      return respErr('email is required');
    }

    const [row] = await db()
      .select({ emailVerified: user.emailVerified })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    return respData({ emailVerified: !!row?.emailVerified });
  } catch (e) {
    console.log('check email verified failed:', e);
    return respErr('check email verified failed');
  }
}
