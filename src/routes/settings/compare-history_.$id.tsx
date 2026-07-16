import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Download, Pencil, Send, X } from 'lucide-react';
import { m } from '@/paraglide/messages.js';
import { Link } from '@/core/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MarkdownContent } from '@/components/markdown-content';
import { RichTextEditor } from '@/components/rich-text-editor';
import { cn } from '@/lib/utils';
import { apiGet, apiPatch, apiPost } from '@/lib/api-client';
import { TraceTable, type TraceRow } from '../compare/-trace-table';
import { ParamMatrix } from '../compare/-param-matrix';
import { ChipChat } from '../compare/-chip-chat';
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

function slugify(parts: string): string {
  return `compare-${parts
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60)}-${Date.now().toString(36)}`;
}

function CompareRecordPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [traceView, setTraceView] = useState<'matrix' | 'table'>('matrix');
  const [publishOpen, setPublishOpen] = useState(false);
  const [pubTitle, setPubTitle] = useState('');
  const [pubSlug, setPubSlug] = useState('');
  const [pubDescription, setPubDescription] = useState('');
  const [pubStatus, setPubStatus] = useState<'draft' | 'published'>('published');
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);

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

  const saveMutation = useMutation({
    mutationFn: () => apiPatch(`/api/chip-compare/records/${id}`, { result: draft }),
    onSuccess: () => {
      toast.success(m['compare.edit.saved']());
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['compare-record', id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publishMutation = useMutation({
    mutationFn: () =>
      apiPost<{ slug: string }>(`/api/chip-compare/records/${id}/publish`, {
        title: pubTitle,
        slug: pubSlug,
        description: pubDescription,
        status: pubStatus,
      }),
    onSuccess: (data) => {
      toast.success(m['compare.edit.published']());
      setPublishOpen(false);
      setPublishedSlug(data.slug);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openPublish() {
    if (!record) return;
    const parts = partsLabel(record.chipPartNumbers);
    setPubTitle(parts);
    setPubSlug(slugify(parts));
    setPubDescription('');
    setPublishOpen(true);
  }

  function startEdit() {
    setDraft(record?.result ?? '');
    setEditing(true);
  }

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
                <span>
                  {record.costCredits} {m['settings.compare_history.col_credits']()}
                </span>
              </div>
            </div>
            {record.status === 'success' && (
              <div className="flex flex-wrap gap-2">
                {publishedSlug && (
                  <Link href={`/blog/${publishedSlug}`}>
                    <Button variant="outline" size="sm">
                      {m['compare.edit.view_post']()}
                    </Button>
                  </Link>
                )}
                <Button variant="outline" size="sm" onClick={openPublish}>
                  <Send className="size-4" />
                  {m['compare.edit.publish']()}
                </Button>
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

          {(record.result || editing) && (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>{m['compare.report.tab_report']()}</CardTitle>
                {editing ? (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                      <X className="size-4" />
                      {m['compare.edit.cancel']()}
                    </Button>
                    <Button size="sm" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                      {m['compare.edit.save']()}
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={startEdit}>
                    <Pencil className="size-4" />
                    {m['compare.edit.edit']()}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {editing ? (
                  <RichTextEditor value={draft} onChange={setDraft} />
                ) : (
                  <MarkdownContent content={record.result ?? ''} />
                )}
              </CardContent>
            </Card>
          )}

          {record.status === 'success' && (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>{m['compare.report.tab_traces']()}</CardTitle>
                <div className="flex gap-1 rounded-lg border border-border p-0.5">
                  {(['matrix', 'table'] as const).map((view) => (
                    <button
                      key={view}
                      onClick={() => setTraceView(view)}
                      className={cn(
                        'rounded-md px-3 py-1 text-sm transition-colors',
                        traceView === view
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {view === 'matrix' ? m['compare.matrix.tab']() : m['compare.report.tab_traces']()}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                {traceView === 'matrix' ? (
                  <ParamMatrix traces={tracesQuery.data ?? []} />
                ) : (
                  <TraceTable traces={tracesQuery.data ?? []} editable />
                )}
              </CardContent>
            </Card>
          )}

          <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{m['compare.edit.publish_title']()}</DialogTitle>
                <DialogDescription>{m['compare.edit.publish_hint']()}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>{m['compare.edit.field_title']()}</Label>
                  <Input value={pubTitle} onChange={(e) => setPubTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{m['compare.edit.field_slug']()}</Label>
                  <Input value={pubSlug} onChange={(e) => setPubSlug(e.target.value)} className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>{m['compare.edit.field_description']()}</Label>
                  <Input value={pubDescription} onChange={(e) => setPubDescription(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{m['compare.edit.field_status']()}</Label>
                  <Select
                    value={pubStatus}
                    onValueChange={(v) => setPubStatus(v === 'draft' ? 'draft' : 'published')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="published">{m['compare.edit.status_published']()}</SelectItem>
                      <SelectItem value="draft">{m['compare.edit.status_draft']()}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPublishOpen(false)}>
                  {m['compare.edit.cancel']()}
                </Button>
                <Button
                  disabled={publishMutation.isPending || !pubTitle.trim() || !pubSlug.trim()}
                  onClick={() => publishMutation.mutate()}
                >
                  {m['compare.edit.publish']()}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <ChipChat recordId={id} />
        </>
      )}
    </div>
  );
}

export const Route = createFileRoute('/settings/compare-history_/$id')({
  component: CompareRecordPage,
});
