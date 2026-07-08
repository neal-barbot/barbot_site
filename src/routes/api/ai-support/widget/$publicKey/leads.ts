import { createFileRoute } from '@tanstack/react-router';
import { createPublicLead, getPublicWidgetConfig } from '@/modules/ai-support/service';
import { enforceMinIntervalRateLimit } from '@/lib/rate-limit';
import { respData, respErr } from '@/lib/resp';
import { isAllowedWidgetRequest } from '../-security';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function withCors(response: Response) {
  Object.entries(corsHeaders).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

function objectMetadata(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

async function POST({ request, params }: { request: Request; params: { publicKey: string } }) {
  try {
    const limited = enforceMinIntervalRateLimit(request, {
      intervalMs: 2000,
      keyPrefix: 'ai-support-widget-lead',
      extraKey: params.publicKey,
    });
    if (limited) return withCors(limited);

    const config = await getPublicWidgetConfig(params.publicKey);
    if (!isAllowedWidgetRequest(request, config.allowedDomains)) {
      return withCors(respErr('Origin is not allowed for this chatbot'));
    }

    const body = await request.json().catch(() => ({}));
    const row = await createPublicLead({
      publicKey: params.publicKey,
      conversationId: typeof body.conversationId === 'string' ? body.conversationId : undefined,
      name: typeof body.name === 'string' ? body.name : undefined,
      email: typeof body.email === 'string' ? body.email : undefined,
      phone: typeof body.phone === 'string' ? body.phone : undefined,
      sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl : undefined,
      metadata: objectMetadata(body.metadata),
    });
    return withCors(respData(row));
  } catch (error: any) {
    return withCors(respErr(error.message || 'Internal error'));
  }
}

function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export const Route = createFileRoute('/api/ai-support/widget/$publicKey/leads')({
  server: {
    handlers: { POST, OPTIONS },
  },
});
