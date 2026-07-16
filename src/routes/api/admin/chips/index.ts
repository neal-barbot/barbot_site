import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { respData, respErr, respPage } from '@/lib/resp';
import { getAuth } from '@/core/auth';
import { hasPermission } from '@/modules/rbac/service';
import { createChip, listChips } from '@/modules/chips/service';

async function checkAdmin(request: Request) {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw new Error('Unauthorized');
  const isAdmin = await hasPermission(session.user.id, 'admin.*');
  if (!isAdmin) throw new Error('Forbidden');
  return session;
}

const chipSchema = z.object({
  manufacturer: z.string().max(255).nullish(),
  partNumber: z.string().min(1).max(255),
  description: z.string().max(2000).nullish(),
  sheetUrl: z.string().url().max(1024).nullish().or(z.literal('').transform(() => null)),
  parameter: z.string().max(100_000).nullish(),
  segmentId: z.string().max(64).nullish().or(z.literal('').transform(() => null)),
});

async function GET({ request }: { request: Request }) {
  try {
    await checkAdmin(request);
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '10')));
    const search = searchParams.get('search') || undefined;
    const segmentId = searchParams.get('segmentId') || undefined;

    const { items, total } = await listChips({ search, segmentId, page, pageSize });
    return respPage(items, total);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

async function POST({ request }: { request: Request }) {
  try {
    await checkAdmin(request);
    const input = chipSchema.parse(await request.json());
    const created = await createChip(input);
    return respData(created);
  } catch (error: any) {
    return respErr(error.issues?.[0]?.message || error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/admin/chips/')({
  server: { handlers: { GET, POST } },
});
