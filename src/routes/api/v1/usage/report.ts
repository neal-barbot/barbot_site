import { createFileRoute } from '@tanstack/react-router';
import { verifyDesktopBearer } from '@/modules/agent-gateway/desktop';
import { billUsageEntry, usageEntrySchema } from '@/modules/agent-gateway/usage';
import { getUuid } from '@/lib/hash';

/** Token usage reporting from the Harvey client. Deducts platform credits. */
async function POST({ request }: { request: Request }) {
  const claims = verifyDesktopBearer(request);
  if (!claims) return Response.json({ error: { message: 'Unauthorized' } }, { status: 401 });

  const parsed = usageEntrySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { message: 'Invalid usage entry' } }, { status: 400 });
  }

  try {
    const result = await billUsageEntry(claims.userId, parsed.data);
    return Response.json({ success: result.deducted || result.duplicate, id: getUuid() });
  } catch (error) {
    console.error('Usage report failed:', error);
    return Response.json({ error: { message: 'Usage recording failed' } }, { status: 500 });
  }
}

export const Route = createFileRoute('/api/v1/usage/report')({
  server: { handlers: { POST } },
});
