import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import { getAiSupportUsage, type AiSupportUsage } from '@/modules/ai-support/service';
import { respData, respErr } from '@/lib/resp';

function csvCell(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

function usageToCsv(usage: AiSupportUsage): string {
  const rows = [
    [
      'chatbot_id',
      'name',
      'status',
      'install_status',
      'knowledge_sources',
      'conversations',
      'messages',
      'leads',
      'escalations',
      'open_escalations',
      'generated_at',
      'reset_at',
    ],
    ...usage.byChatbot.map((row) => [
      row.chatbotId,
      row.name,
      row.status,
      row.installStatus,
      row.knowledgeSources,
      row.conversations,
      row.messages,
      row.leads,
      row.escalations,
      row.openEscalations,
      usage.generatedAt,
      usage.resetAt,
    ]),
  ];

  return `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
}

async function GET({ request }: { request: Request }) {
  try {
    const auth = getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return respErr('Unauthorized');

    const usage = await getAiSupportUsage(session.user.id);
    const url = new URL(request.url);
    if (url.searchParams.get('format') === 'csv') {
      return new Response(usageToCsv(usage), {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="ai-support-usage.csv"',
        },
      });
    }

    return respData(usage);
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/ai-support/usage')({
  server: {
    handlers: { GET },
  },
});
