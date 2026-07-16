import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { Flame } from 'lucide-react';
import { m } from '@/paraglide/messages.js';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { DataTable, type Column } from '@/components/data-table';
import { apiGet, apiPost, type PageResult } from '@/lib/api-client';

interface RecordRow {
  id: string;
  userId: string;
  chipPartNumbers: string;
  status: string;
  stage: string;
  model: string;
  source: string;
  costCredits: number;
  cacheHit: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  error: string | null;
  createdAt: string;
}

const PAGE_SIZE = 10;
const STATUS_FILTERS = ['all', 'success', 'failed', 'parsing', 'analyzing'] as const;
const SOURCE_FILTERS = ['all', 'user', 'preheat'] as const;

function partsLabel(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.join(' vs ') : raw;
  } catch {
    return raw;
  }
}

function AdminChipComparePage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('all');
  const [source, setSource] = useState<string>('all');
  const [preheatOpen, setPreheatOpen] = useState(false);
  const [preheatParts, setPreheatParts] = useState('');
  const [preheatLanguage, setPreheatLanguage] = useState('en');

  const listQuery = useQuery({
    queryKey: ['admin-chip-compare', page, status, source],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (status !== 'all') params.set('status', status);
      if (source !== 'all') params.set('source', source);
      return apiGet<PageResult<RecordRow>>(`/api/admin/chip-compare/records?${params}`);
    },
    placeholderData: keepPreviousData,
  });

  const preheatMutation = useMutation({
    mutationFn: () =>
      apiPost('/api/admin/chip-compare/preheat', {
        parts: preheatParts
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean),
        language: preheatLanguage,
      }),
    onSuccess: () => {
      toast.success(m['admin.chip_compare.preheat_started']());
      setPreheatOpen(false);
      setPreheatParts('');
      setTimeout(
        () => queryClient.invalidateQueries({ queryKey: ['admin-chip-compare'] }),
        1500
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusVariant = (s: string) =>
    s === 'success'
      ? ('default' as const)
      : s === 'failed'
        ? ('destructive' as const)
        : ('secondary' as const);

  const columns: Column<RecordRow>[] = [
    {
      header: m['admin.chip_compare.col_parts'](),
      cell: (r) => (
        <div>
          <span className="font-mono text-sm font-medium">{partsLabel(r.chipPartNumbers)}</span>
          {r.error && (
            <p className="mt-0.5 max-w-xs truncate text-xs text-destructive">{r.error}</p>
          )}
        </div>
      ),
    },
    {
      header: m['admin.chip_compare.col_user'](),
      cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.userId.slice(0, 8)}</span>,
    },
    {
      header: m['admin.chip_compare.col_status'](),
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
          {r.cacheHit && <Badge variant="outline">cache</Badge>}
        </div>
      ),
    },
    {
      header: m['admin.chip_compare.col_source'](),
      cell: (r) => <Badge variant={r.source === 'preheat' ? 'secondary' : 'outline'}>{r.source}</Badge>,
    },
    {
      header: m['admin.chip_compare.col_tokens'](),
      cell: (r) =>
        r.inputTokens != null ? (
          <span className="font-mono text-xs">
            {r.inputTokens}/{r.outputTokens}
          </span>
        ) : (
          '—'
        ),
    },
    { header: m['admin.chip_compare.col_credits'](), cell: (r) => r.costCredits },
    {
      header: m['admin.chip_compare.col_created'](),
      cell: (r) => (
        <span className="text-sm text-muted-foreground">
          {new Date(r.createdAt).toLocaleString()}
        </span>
      ),
    },
  ];

  const filters = (
    <div className="flex gap-2">
      <Select value={status} onValueChange={(v) => { setStatus(v ?? 'all'); setPage(1); }}>
        <SelectTrigger className="h-8 w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_FILTERS.map((s) => (
            <SelectItem key={s} value={s}>
              {s === 'all' ? m['admin.chip_compare.filter_all']() : s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={source} onValueChange={(v) => { setSource(v ?? 'all'); setPage(1); }}>
        <SelectTrigger className="h-8 w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SOURCE_FILTERS.map((s) => (
            <SelectItem key={s} value={s}>
              {s === 'all' ? m['admin.chip_compare.filter_all']() : s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{m['admin.chip_compare.title']()}</h1>
          <p className="text-muted-foreground">{m['admin.chip_compare.description']()}</p>
        </div>
        <Dialog open={preheatOpen} onOpenChange={setPreheatOpen}>
          <DialogTrigger className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80">
            <Flame className="size-4" />
            {m['admin.chip_compare.preheat']()}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{m['admin.chip_compare.preheat_title']()}</DialogTitle>
              <DialogDescription>{m['admin.chip_compare.preheat_hint']()}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>{m['admin.chip_compare.col_parts']()}</Label>
                <Input
                  value={preheatParts}
                  onChange={(e) => setPreheatParts(e.target.value)}
                  placeholder={m['admin.chip_compare.preheat_parts_placeholder']()}
                />
              </div>
              <div className="space-y-2">
                <Label>{m['admin.chip_compare.preheat_language']()}</Label>
                <Select value={preheatLanguage} onValueChange={(v) => setPreheatLanguage(v ?? 'en')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="zh">中文</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreheatOpen(false)}>
                {m['admin.chip_compare.cancel']()}
              </Button>
              <Button
                disabled={
                  preheatMutation.isPending ||
                  preheatParts.split(',').filter((p) => p.trim()).length < 2
                }
                onClick={() => preheatMutation.mutate()}
              >
                {m['admin.chip_compare.start']()}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent>
          <DataTable
            columns={columns}
            data={listQuery.data?.items ?? []}
            total={listQuery.data?.total ?? 0}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            rowKey={(r) => r.id}
            emptyText={m['admin.chip_compare.no_data']()}
            toolbar={filters}
            onRefresh={() => listQuery.refetch()}
            loading={listQuery.isFetching}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute('/admin/chip-compare')({
  component: AdminChipComparePage,
});
