import { createFileRoute } from '@tanstack/react-router';
import { getPublicWidgetConfig } from '@/modules/ai-support/service';
import { respData, respErr } from '@/lib/resp';
import { isAllowedWidgetRequest } from './-security';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function withCors(response: Response) {
  Object.entries(corsHeaders).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

async function GET({ request, params }: { request: Request; params: { publicKey: string } }) {
  try {
    const config = await getPublicWidgetConfig(params.publicKey);
    if (!isAllowedWidgetRequest(request, config.allowedDomains)) {
      return withCors(respErr('Origin is not allowed for this chatbot'));
    }
    return withCors(respData(config));
  } catch (error: any) {
    return withCors(respErr(error.message || 'Internal error'));
  }
}

function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export const Route = createFileRoute('/api/ai-support/widget/$publicKey')({
  server: {
    handlers: { GET, OPTIONS },
  },
});
