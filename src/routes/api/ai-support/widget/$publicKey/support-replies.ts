import { createFileRoute } from '@tanstack/react-router';
import { getPublicWidgetConfig, listPublicSupportReplies } from '@/modules/ai-support/service';
import { respData, respErr } from '@/lib/resp';
import { isAllowedWidgetRequest } from '../-security';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
    const conversationId = new URL(request.url).searchParams.get('conversationId') || '';
    if (!conversationId) return withCors(respErr('Conversation id is required'));
    return withCors(respData(await listPublicSupportReplies({ publicKey: params.publicKey, conversationId })));
  } catch (error: unknown) {
    return withCors(respErr(error instanceof Error ? error.message : 'Unable to load support replies'));
  }
}

function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export const Route = createFileRoute('/api/ai-support/widget/$publicKey/support-replies')({
  server: { handlers: { GET, OPTIONS } },
});
