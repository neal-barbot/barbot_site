import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, Eye, Trash2 } from 'lucide-react';
import { m } from '@/paraglide/messages.js';
import { Link } from '@/core/i18n/navigation';
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
} from '@/components/ui/dialog';
import { DataTable, type Column } from '@/components/data-table';
import { apiDelete, apiGet, type PageResult } from '@/lib/api-client';

interface RecordRow {
  id: string;
  chipPartNumbers: string;
  status: string;
  model: string;
  costCredits: number;
  cacheHit: boolean;
  durationMs: number | null;
  createdAt: string;
}

const PAGE_SIZE = 10;

export function statusBadge(status: string) {
  const variant =
    status === 'success'
      ? ('default' as const)
      : status === 'failed'
        ? ('destructive' as const)
        : ('secondary' as const);
  return <Badge variant={variant}>{status}</Badge>;
}

export function partsLabel(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.join(' vs ') : raw;
  } catch {
    return raw;
  }
}

function CompareHistoryPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<RecordRow | null>(null);

  const listQuery = useQuery({
    queryKey: ['compare-history', page],
    queryFn: () =>
      apiGet<PageResult<RecordRow>>(
        `/api/chip-compare/records?page=${page}&pageSize=${PAGE_SIZE}`
      ),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/chip-compare/records/${id}`),
    onSuccess: () => {
      toast.success(m['settings.compare_history.deleted']());
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ['compare-history'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: Column<RecordRow>[] = [
    {
      header: m['settings.compare_history.col_parts'](),
      cell: (r) => (
        <Link
          href={`/settings/compare-history/${r.id}`}
          className="font-mono text-sm font-medium text-primary hover:underline"
        >
          {partsLabel(r.chipPartNumbers)}
        </Link>
      ),
    },
    {
      header: m['settings.compare_history.col_status'](),
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          {statusBadge(r.status)}
          {r.cacheHit && (
            <Badge variant="outline">{m['settings.compare_history.cache_hit']()}</Badge>
          )}
        </div>
      ),
    },
    {
      header: m['settings.compare_history.col_model'](),
      cell: (r) => <span className="font-mono text-xs">{r.model}</span>,
    },
    {
      header: m['settings.compare_history.col_credits'](),
      cell: (r) => r.costCredits,
    },
    {
      header: m['settings.compare_history.col_created'](),
      cell: (r) => (
        <span className="text-sm text-muted-foreground">
          {new Date(r.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      header: m['settings.compare_history.col_actions'](),
      className: 'w-[130px]',
      cell: (r) => (
        <div className="flex gap-1">
          <Link href={`/settings/compare-history/${r.id}`}>
            <Button variant="ghost" size="icon" className="size-7">
              <Eye className="size-3.5" />
            </Button>
          </Link>
          {r.status === 'success' && (
            <a href={`/api/chip-compare/records/${r.id}/export`} download>
              <Button variant="ghost" size="icon" className="size-7">
                <Download className="size-3.5" />
              </Button>
            </a>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setDeleting(r)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{m['settings.compare_history.title']()}</h1>
        <p className="text-muted-foreground">{m['settings.compare_history.description']()}</p>
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
            emptyText={m['settings.compare_history.no_data']()}
            onRefresh={() => listQuery.refetch()}
            loading={listQuery.isFetching}
          />
        </CardContent>
      </Card>

      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m['settings.compare_history.delete_title']()}</DialogTitle>
            <DialogDescription>
              {m['settings.compare_history.delete_confirm']()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {m['settings.compare_history.cancel']()}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            >
              {m['settings.compare_history.confirm_delete']()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute('/settings/compare-history')({
  component: CompareHistoryPage,
});
