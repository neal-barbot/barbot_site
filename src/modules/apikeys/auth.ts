import { getAuth } from '@/core/auth';
import { validate as validateApiKey } from './service';

/**
 * Resolve the calling user from a browser session cookie OR an
 * `Authorization: Bearer <api key>` header (the agent interface).
 * Returns the userId, or null when unauthenticated.
 */
export async function resolveUserId(request: Request): Promise<string | null> {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: request.headers });
  if (session?.user) return session.user.id;

  const bearer = request.headers.get('authorization');
  if (bearer?.startsWith('Bearer ')) {
    return validateApiKey(bearer.slice(7).trim());
  }
  return null;
}
