import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download } from 'lucide-react';
import { m } from '@/paraglide/messages.js';
import { Link } from '@/core/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarkdownContent } from '@/components/markdown-content';
import { apiGet } from '@/lib/api-client';
import { TraceTable, type TraceRow } from '../compare/-trace-table';
import { partsLabel, statusBadge } from './compare-history';

interface RecordDetail {
  id: string;
  chipPartNumbers: string;
  status: string;
  model: string;
  language: string;
  result: string | null;
  costCredits: number;
  cacheHit: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
}

function CompareRecordPage() {
  const { id } = Route.useParams();

  const recordQuery = useQuery({
    queryKey: ['compare-record', id],
    queryFn: () => apiGet<RecordDetail>(`/api/chip-compare/records/${id}`),
  });

  const tracesQuery = useQuery({
    queryKey: ['compare-traces', id],
    queryFn: () => apiGet<TraceRow[]>(`/api/chip-compare/records/${id}/traces`),
    enabled: recordQuery.data?.status === 'success',
  });

  const record = recordQuery.data;

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/settings/compare-history"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {m['settings.compare_history.back']()}
      </Link>

      {!record ? (
        <div className="py-20 text-center text-muted-foreground">…</div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-mono text-2xl font-bold">{partsLabel(record.chipPartNumbers)}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {statusBadge(record.status)}
                {record.cacheHit && (
                  <Badge variant="outline">{m['settings.compare_history.cache_hit']()}</Badge>
                )}
                <span className="font-mono text-xs">{record.model}</span>
                <span>{new Date(record.createdAt).toLocaleString()}</span>
                {record.durationMs != null && <span>{(record.durationMs / 1000).toFixed(1)}s</span>}
                {record.inputTokens != null && (
                  <span>
                    {record.inputTokens}/{record.outputTokens} tokens
                  </span>
                )}
                <span>
                  {record.costCredits} {m['settings.compare_history.col_credits']()}
                </span>
              </div>
            </div>
            {record.status === 'success' && (
              <div className="flex gap-2">
                <a href={`/api/chip-compare/records/${record.id}/export`} download>
                  <Button variant="outline" size="sm">
                    <Download className="size-4" />
                    {m['settings.compare_history.export_md']()}
                  </Button>
                </a>
                <a href={`/api/chip-compare/records/${record.id}/export?format=csv`} download>
                  <Button variant="outline" size="sm">
                    <Download className="size-4" />
                    {m['settings.compare_history.export_csv']()}
                  </Button>
                </a>
              </div>
            )}
          </div>

          {record.error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {m['settings.compare_history.error_label']()}: {record.error}
            </div>
          )}

          {record.result && (
            <Card>
              <CardHeader>
                <CardTitle>{m['compare.report.tab_report']()}</CardTitle>
              </CardHeader>
              <CardContent>
                <MarkdownContent content={record.result} />
              </CardContent>
            </Card>
          )}

          {record.status === 'success' && (
            <Card>
              <CardHeader>
                <CardTitle>{m['compare.report.tab_traces']()}</CardTitle>
              </CardHeader>
              <CardContent>
                <TraceTable traces={tracesQuery.data ?? []} editable />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export const Route = createFileRoute('/settings/compare-history_/$id')({
  component: CompareRecordPage,
});
