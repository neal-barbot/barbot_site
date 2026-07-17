import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2, Upload } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, type Column } from '@/components/data-table';
import { TextField } from '@/components/form-field';
import {
  apiDelete,
  apiFormData,
  apiGet,
  apiPost,
  apiPut,
  type PageResult,
} from '@/lib/api-client';

interface ChipRow {
  id: string;
  manufacturer: string | null;
  partNumber: string;
  description: string | null;
  sheetUrl: string | null;
  parameter: string | null;
  segmentId: string | null;
  updatedAt: string;
}

interface SegmentNode {
  id: string;
  name: string;
  children: Array<{ id: string; name: string }>;
}

interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

const PAGE_SIZE = 10;

const chipSchema = z.object({
  partNumber: z.string().min(1),
  manufacturer: z.string(),
  description: z.string(),
  sheetUrl: z.string(),
  parameter: z.string(),
  segmentId: z.string(),
});
type ChipForm = z.infer<typeof chipSchema>;
const emptyForm: ChipForm = {
  partNumber: '',
  manufacturer: '',
  description: '',
  sheetUrl: '',
  parameter: '',
  segmentId: '',
};

function toPayload(value: ChipForm) {
  return {
    partNumber: value.partNumber,
    manufacturer: value.manufacturer || null,
    description: value.description || null,
    sheetUrl: value.sheetUrl || '',
    parameter: value.parameter || null,
    segmentId: value.segmentId || '',
  };
}

function AdminChipsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ChipRow | null>(null);
  const [deleting, setDeleting] = useState<ChipRow | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const segmentsQuery = useQuery({
    queryKey: ['admin-chip-segments'],
    queryFn: () => apiGet<SegmentNode[]>('/api/admin/chip-segments'),
  });
  const segmentOptions = (segmentsQuery.data ?? []).flatMap((major) => [
    { id: major.id, name: major.name },
    ...major.children.map((c) => ({ id: c.id, name: `${major.name} / ${c.name}` })),
  ]);

  const listQuery = useQuery({
    queryKey: ['admin-chips', page, debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (debouncedSearch) params.set('search', debouncedSearch);
      return apiGet<PageResult<ChipRow>>(`/api/admin/chips?${params}`);
    },
    placeholderData: keepPreviousData,
  });

  const createForm = useForm({
    defaultValues: emptyForm,
    validators: { onSubmit: chipSchema },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync(value);
    },
  });

  const editForm = useForm({
    defaultValues: emptyForm,
    validators: { onSubmit: chipSchema },
    onSubmit: async ({ value }) => {
      if (!editing) return;
      await editMutation.mutateAsync(value);
    },
  });

  const createMutation = useMutation({
    mutationFn: (value: ChipForm) => apiPost('/api/admin/chips', toPayload(value)),
    onSuccess: () => {
      toast.success(m['admin.chips.created']());
      setCreateOpen(false);
      createForm.reset();
      queryClient.invalidateQueries({ queryKey: ['admin-chips'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: (value: ChipForm) =>
      apiPut(`/api/admin/chips/${editing!.id}`, toPayload(value)),
    onSuccess: () => {
      toast.success(m['admin.chips.updated']());
      setEditing(null);
      editForm.reset();
      queryClient.invalidateQueries({ queryKey: ['admin-chips'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/admin/chips/${id}`),
    onSuccess: () => {
      toast.success(m['admin.chips.deleted']());
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ['admin-chips'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleImport(file: File | null) {
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await apiFormData<ImportResult>('/api/admin/chips/import', formData);
      toast.success(m['admin.chips.import_result'](result));
      if (result.errors.length > 0) {
        toast.warning(result.errors.slice(0, 3).join('; '));
      }
      queryClient.invalidateQueries({ queryKey: ['admin-chips'] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  }

  function openEdit(c: ChipRow) {
    editForm.reset({
      partNumber: c.partNumber,
      manufacturer: c.manufacturer || '',
      description: c.description || '',
      sheetUrl: c.sheetUrl || '',
      parameter: c.parameter || '',
      segmentId: c.segmentId || '',
    });
    setEditing(c);
  }

  const segmentName = (id: string | null) =>
    segmentOptions.find((s) => s.id === id)?.name ?? '';

  const columns: Column<ChipRow>[] = [
    {
      header: m['admin.chips.col_part_number'](),
      cell: (c) => <span className="font-mono font-medium">{c.partNumber}</span>,
    },
    { header: m['admin.chips.col_manufacturer'](), cell: (c) => c.manufacturer || '—' },
    {
      header: m['admin.chips.field_segment'](),
      cell: (c) =>
        c.segmentId ? <Badge variant="secondary">{segmentName(c.segmentId)}</Badge> : '—',
    },
    {
      header: m['admin.chips.col_updated'](),
      cell: (c) => (
        <span className="text-sm text-muted-foreground">
          {new Date(c.updatedAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: m['admin.chips.col_actions'](),
      className: 'w-[80px]',
      cell: (c) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(c)}>
            <Pencil className="size-3" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setDeleting(c)}>
            <Trash2 className="size-3" />
          </Button>
        </div>
      ),
    },
  ];

  function renderFields(form: typeof createForm) {
    return (
      <div className="space-y-4 py-4">
        <form.Field name="partNumber">
          {(field) => <TextField field={field} label={m['admin.chips.field_part_number']()} />}
        </form.Field>
        <form.Field name="manufacturer">
          {(field) => <TextField field={field} label={m['admin.chips.field_manufacturer']()} />}
        </form.Field>
        <form.Field name="description">
          {(field) => <TextField field={field} label={m['admin.chips.field_description']()} />}
        </form.Field>
        <form.Field name="sheetUrl">
          {(field) => (
            <TextField field={field} label={m['admin.chips.field_sheet_url']()} placeholder="https://…" />
          )}
        </form.Field>
        <form.Field name="segmentId">
          {(field) => (
            <div className="space-y-2">
              <Label>{m['admin.chips.field_segment']()}</Label>
              <Select
                value={field.state.value || 'none'}
                onValueChange={(v) => field.handleChange(!v || v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{m['admin.chips.no_segment']()}</SelectItem>
                  {segmentOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </form.Field>
        <form.Field name="parameter">
          {(field) => (
            <TextField
              field={field}
              label={m['admin.chips.field_parameter']()}
              placeholder='{"VDD": "3.3V"}'
            />
          )}
        </form.Field>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{m['admin.chips.title']()}</h1>
          <p className="text-muted-foreground">{m['admin.chips.description']()}</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => handleImport(e.target.files?.[0] ?? null)}
          />
          <Button
            variant="outline"
            disabled={importing}
            onClick={() => importInputRef.current?.click()}
            title={m['admin.chips.import_hint']()}
          >
            <Upload className="size-4" />
            {m['admin.chips.import_csv']()}
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80">
              <Plus className="size-4" />
              {m['admin.chips.create']()}
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>{m['admin.chips.create_title']()}</DialogTitle>
                <DialogDescription>{m['admin.chips.import_hint']()}</DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  createForm.handleSubmit();
                }}
              >
                {renderFields(createForm)}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                    {m['admin.chips.cancel']()}
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {m['admin.chips.save']()}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
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
            rowKey={(c) => c.id}
            emptyText={m['admin.chips.no_data']()}
            search={search}
            onSearchChange={setSearch}
            onRefresh={() => listQuery.refetch()}
            loading={listQuery.isFetching}
          />
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{m['admin.chips.edit_title']()}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              editForm.handleSubmit();
            }}
          >
            {renderFields(editForm)}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                {m['admin.chips.cancel']()}
              </Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {m['admin.chips.save']()}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m['admin.chips.delete_title']()}</DialogTitle>
            <DialogDescription>{m['admin.chips.delete_confirm']()}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {m['admin.chips.cancel']()}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            >
              {m['admin.chips.confirm_delete']()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute('/admin/chips')({
  component: AdminChipsPage,
});
