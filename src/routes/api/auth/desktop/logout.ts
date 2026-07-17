import { createFileRoute } from '@tanstack/react-router';

/**
 * Desktop logout. Tokens are stateless JWTs (no server-side session store),
 * so logout is client-side deletion; this endpoint just acknowledges.
 */
async function POST() {
  return Response.json({ success: true });
}

export const Route = createFileRoute('/api/auth/desktop/logout')({
  server: { handlers: { POST } },
});
