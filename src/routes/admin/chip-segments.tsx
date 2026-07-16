import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { CornerDownRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { m } from '@/paraglide/messages.js';
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
import { TextField } from '@/components/form-field';
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api-client';

interface Segment {
  id: string;
  parentId: string | null;
  name: string;
  description: string | null;
  sort: number;
}

interface SegmentNode extends Segment {
  children: Segment[];
}

const segmentSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  parentId: z.string(),
  sort: z.string(),
});
type SegmentForm = z.infer<typeof segmentSchema>;
const emptyForm: SegmentForm = { name: '', description: '', parentId: '', sort: '0' };

function AdminChipSegmentsPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Segment | null>(null);
  const [deleting, setDeleting] = useState<Segment | null>(null);

  const listQuery = useQuery({
    queryKey: ['admin-chip-segments'],
    queryFn: () => apiGet<SegmentNode[]>('/api/admin/chip-segments'),
  });
  const majors = listQuery.data ?? [];

  const createForm = useForm({
    defaultValues: emptyForm,
    validators: { onSubmit: segmentSchema },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync(value);
    },
  });

  const editForm = useForm({
    defaultValues: emptyForm,
    validators: { onSubmit: segmentSchema },
    onSubmit: async ({ value }) => {
      if (!editing) return;
      await editMutation.mutateAsync(value);
    },
  });

  const createMutation = useMutation({
    mutationFn: (value: SegmentForm) =>
      apiPost('/api/admin/chip-segments', {
        name: value.name,
        description: value.description || null,
        parentId: value.parentId || '',
        sort: parseInt(value.sort) || 0,
      }),
    onSuccess: () => {
      toast.success(m['admin.chip_segments.created']());
      setCreateOpen(false);
      createForm.reset();
      queryClient.invalidateQueries({ queryKey: ['admin-chip-segments'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: (value: SegmentForm) =>
      apiPut('/api/admin/chip-segments', {
        id: editing!.id,
        name: value.name,
        description: value.description || null,
        sort: parseInt(value.sort) || 0,
      }),
    onSuccess: () => {
      toast.success(m['admin.chip_segments.updated']());
      setEditing(null);
      editForm.reset();
      queryClient.invalidateQueries({ queryKey: ['admin-chip-segments'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/admin/chip-segments?id=${id}`),
    onSuccess: () => {
      toast.success(m['admin.chip_segments.deleted']());
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ['admin-chip-segments'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openEdit(s: Segment) {
    editForm.reset({
      name: s.name,
      description: s.description || '',
      parentId: s.parentId || '',
      sort: String(s.sort),
    });
    setEditing(s);
  }

  function renderRow(segment: Segment, isChild: boolean) {
    return (
      <tr key={segment.id} className="border-b border-border/50">
        <td className="py-2 pr-4">
          <span className="flex items-center gap-1.5 font-medium">
            {isChild && <CornerDownRight className="size-3.5 text-muted-foreground" />}
            {segment.name}
          </span>
        </td>
        <td className="py-2 pr-4 text-muted-foreground">{segment.description || '—'}</td>
        <td className="py-2 pr-4">{segment.sort}</td>
        <td className="w-[80px] py-2">
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(segment)}>
              <Pencil className="size-3" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => setDeleting(segment)}>
              <Trash2 className="size-3" />
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  function renderFields(form: typeof createForm, showParent: boolean) {
    return (
      <div className="space-y-4 py-4">
        <form.Field name="name">
          {(field) => <TextField field={field} label={m['admin.chip_segments.field_name']()} />}
        </form.Field>
        <form.Field name="description">
          {(field) => (
            <TextField field={field} label={m['admin.chip_segments.field_description']()} />
          )}
        </form.Field>
        {showParent && (
          <form.Field name="parentId">
            {(field) => (
              <div className="space-y-2">
                <Label>{m['admin.chip_segments.field_parent']()}</Label>
                <Select
                  value={field.state.value || 'top'}
                  onValueChange={(v) => field.handleChange(!v || v === 'top' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top">{m['admin.chip_segments.top_level']()}</SelectItem>
                    {majors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
        )}
        <form.Field name="sort">
          {(field) => (
            <TextField field={field} label={m['admin.chip_segments.field_sort']()} type="number" />
          )}
        </form.Field>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{m['admin.chip_segments.title']()}</h1>
          <p className="text-muted-foreground">{m['admin.chip_segments.description']()}</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80">
            <Plus className="size-4" />
            {m['admin.chip_segments.create']()}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{m['admin.chip_segments.create_title']()}</DialogTitle>
              <DialogDescription />
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                createForm.handleSubmit();
              }}
            >
              {renderFields(createForm, true)}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  {m['admin.chip_segments.cancel']()}
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {m['admin.chip_segments.save']()}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent>
          {majors.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {m['admin.chip_segments.no_data']()}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">{m['admin.chip_segments.col_name']()}</th>
                  <th className="py-2 pr-4 font-medium">
                    {m['admin.chip_segments.col_description']()}
                  </th>
                  <th className="py-2 pr-4 font-medium">{m['admin.chip_segments.col_sort']()}</th>
                  <th className="py-2 font-medium">{m['admin.chip_segments.col_actions']()}</th>
                </tr>
              </thead>
              <tbody>
                {majors.flatMap((major) => [
                  renderRow(major, false),
                  ...major.children.map((child) => renderRow(child, true)),
                ])}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m['admin.chip_segments.edit_title']()}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              editForm.handleSubmit();
            }}
          >
            {renderFields(editForm, false)}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                {m['admin.chip_segments.cancel']()}
              </Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {m['admin.chip_segments.save']()}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m['admin.chip_segments.delete_title']()}</DialogTitle>
            <DialogDescription>{m['admin.chip_segments.delete_confirm']()}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {m['admin.chip_segments.cancel']()}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            >
              {m['admin.chip_segments.confirm_delete']()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute('/admin/chip-segments')({
  component: AdminChipSegmentsPage,
});
