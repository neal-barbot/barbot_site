import { createFileRoute } from '@tanstack/react-router';
import {
  createPublicConversationMessage,
  getPublicWidgetConfig,
} from '@/modules/ai-support/service';
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
      intervalMs: 800,
      keyPrefix: 'ai-support-widget-message',
      extraKey: params.publicKey,
    });
    if (limited) return withCors(limited);

    const config = await getPublicWidgetConfig(params.publicKey);
    if (!isAllowedWidgetRequest(request, config.allowedDomains)) {
      return withCors(respErr('Origin is not allowed for this chatbot'));
    }

    const body = await request.json().catch(() => ({}));
    const result = await createPublicConversationMessage({
      publicKey: params.publicKey,
      conversationId: typeof body.conversationId === 'string' ? body.conversationId : undefined,
      message: typeof body.message === 'string' ? body.message : '',
      visitorId: typeof body.visitorId === 'string' ? body.visitorId : undefined,
      sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl : undefined,
      contactName: typeof body.contactName === 'string' ? body.contactName : undefined,
      contactEmail: typeof body.contactEmail === 'string' ? body.contactEmail : undefined,
      metadata: objectMetadata(body.metadata),
    });
    return withCors(respData(result));
  } catch (error: any) {
    return withCors(respErr(error.message || 'Internal error'));
  }
}

function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export const Route = createFileRoute('/api/ai-support/widget/$publicKey/messages')({
  server: {
    handlers: { POST, OPTIONS },
  },
});
