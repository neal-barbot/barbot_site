import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { verifyDesktopBearer } from '@/modules/agent-gateway/desktop';
import { billUsageEntry, usageEntrySchema } from '@/modules/agent-gateway/usage';

const bodySchema = z.object({ records: z.array(usageEntrySchema).max(100) });

/** Batch variant of usage reporting (offline queue flush). */
async function POST({ request }: { request: Request }) {
  const claims = verifyDesktopBearer(request);
  if (!claims) return Response.json({ error: { message: 'Unauthorized' } }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { message: 'Invalid records' } }, { status: 400 });
  }

  let count = 0;
  for (const entry of parsed.data.records) {
    try {
      const result = await billUsageEntry(claims.userId, entry);
      if (result.deducted || result.duplicate) count++;
    } catch (error) {
      console.error('Batch usage entry failed:', error);
    }
  }
  return Response.json({ success: true, count });
}

export const Route = createFileRoute('/api/v1/usage/report/batch')({
  server: { handlers: { POST } },
});
