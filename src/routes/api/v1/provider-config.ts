import { createFileRoute } from '@tanstack/react-router';
import { buildProviderConfig, verifyDesktopBearer } from '@/modules/agent-gateway/desktop';

/**
 * Relay LLM channel for the desktop/web client. The platform centrally
 * distributes the model endpoint + key — users never handle LLM credentials.
 * Plain JSON.
 */
async function GET({ request }: { request: Request }) {
  const claims = verifyDesktopBearer(request);
  if (!claims) return Response.json({ error: { message: 'Unauthorized' } }, { status: 401 });

  const product = new URL(request.url).searchParams.get('product') || 'desktop_code';
  return Response.json(await buildProviderConfig(product));
}

export const Route = createFileRoute('/api/v1/provider-config')({
  server: { handlers: { GET } },
});
