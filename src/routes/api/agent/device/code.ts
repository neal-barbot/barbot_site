import { createFileRoute } from '@tanstack/react-router';
import { envConfigs } from '@/config';
import { respData } from '@/lib/resp';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { createDeviceAuthorization } from '@/modules/agent-gateway/device';

/** Start a device pairing (public — this is the CLI's very first call). */
async function POST({ request }: { request: Request }) {
  const limited = enforceMinIntervalRateLimit(request, {
    intervalMs: 2000,
    keyPrefix: 'device-code',
  });
  if (limited) return limited;

  const grant = createDeviceAuthorization();
  const base = envConfigs.app_url || new URL(request.url).origin;
  return respData({
    ...grant,
    verificationUri: `${base}/settings/device`,
    verificationUriComplete: `${base}/settings/device?code=${grant.userCode}`,
  });
}

export const Route = createFileRoute('/api/agent/device/code')({
  server: { handlers: { POST } },
});
