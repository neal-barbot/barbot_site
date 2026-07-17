import { createFileRoute } from '@tanstack/react-router';
import { verifyDesktopBearer } from '@/modules/agent-gateway/desktop';

/** Device heartbeat (MVP: acknowledge). */
async function POST({ request }: { request: Request }) {
  const claims = verifyDesktopBearer(request);
  if (!claims) return Response.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  return Response.json({ success: true });
}

export const Route = createFileRoute('/api/v1/device/heartbeat')({
  server: { handlers: { POST } },
});
