import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { verifyDesktopBearer } from '@/modules/agent-gateway/desktop';

const bodySchema = z.object({
  device_id: z.string().min(1).max(100),
  platform: z.string().max(50).optional(),
  product_code: z.string().max(50).optional(),
});

/** Device registration (MVP: acknowledge; no device cap enforced yet). */
async function POST({ request }: { request: Request }) {
  const claims = verifyDesktopBearer(request);
  if (!claims) return Response.json({ error: { message: 'Unauthorized' } }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { message: 'device_id is required' } }, { status: 400 });
  }
  return Response.json({ activated: true, device_id: parsed.data.device_id, limit: 5 });
}

export const Route = createFileRoute('/api/v1/device/register')({
  server: { handlers: { POST } },
});
