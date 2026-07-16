import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { m } from '@/paraglide/messages.js';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiPost } from '@/lib/api-client';

export interface TraceRow {
  id: string;
  paramName: string;
  paramCategory: string | null;
  chipsTrace: string;
  diffLevel: string | null;
  diffNote: string | null;
  userNote: string | null;
}

interface ChipValue {
  chip?: string;
  value?: string;
  page?: number | null;
}

function diffBadge(level: string | null) {
  switch (level) {
    case 'critical':
      return <Badge variant="destructive">{m['compare.trace.diff_critical']()}</Badge>;
    case 'significant':
      return <Badge className="bg-orange-500/15 text-orange-600 dark:text-orange-400">{m['compare.trace.diff_significant']()}</Badge>;
    case 'minor':
      return <Badge variant="secondary">{m['compare.trace.diff_minor']()}</Badge>;
    case 'none':
      return <Badge variant="outline">{m['compare.trace.diff_none']()}</Badge>;
    default:
      return <span className="text-muted-foreground">—</span>;
  }
}

function parseChips(raw: string): ChipValue[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function NoteCell({ trace, editable }: { trace: TraceRow; editable: boolean }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(trace.userNote ?? '');

  const mutation = useMutation({
    mutationFn: (note: string) => apiPost(`/api/chip-compare/traces/${trace.id}/note`, { note }),
    onSuccess: () => {
      toast.success(m['compare.trace.note_saved']());
      queryClient.invalidateQueries({ queryKey: ['compare-traces'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!editable) {
    return <span className="text-sm text-muted-foreground">{trace.userNote || '—'}</span>;
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={m['compare.trace.note_placeholder']()}
        className="h-7 w-40 text-xs"
      />
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        disabled={mutation.isPending || value === (trace.userNote ?? '')}
        onClick={() => mutation.mutate(value)}
      >
        {m['compare.trace.note_save']()}
      </Button>
    </div>
  );
}

export function TraceTable({ traces, editable = false }: { traces: TraceRow[]; editable?: boolean }) {
  if (traces.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{m['compare.trace.empty']()}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2 pr-4 font-medium">{m['compare.trace.col_param']()}</th>
            <th className="py-2 pr-4 font-medium">{m['compare.trace.col_category']()}</th>
            <th className="py-2 pr-4 font-medium">{m['compare.trace.col_chips']()}</th>
            <th className="py-2 pr-4 font-medium">{m['compare.trace.col_diff_level']()}</th>
            <th className="py-2 pr-4 font-medium">{m['compare.trace.col_diff_note']()}</th>
            <th className="py-2 font-medium">{m['compare.trace.col_note']()}</th>
          </tr>
        </thead>
        <tbody>
          {traces.map((trace) => (
            <tr key={trace.id} className="border-b border-border/50 align-top">
              <td className="py-2 pr-4 font-medium">{trace.paramName}</td>
              <td className="py-2 pr-4 text-muted-foreground">{trace.paramCategory || '—'}</td>
              <td className="py-2 pr-4">
                <div className="space-y-1">
                  {parseChips(trace.chipsTrace).map((c, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-xs text-muted-foreground">{c.chip}</span>
                      <span className="font-mono">{c.value ?? '—'}</span>
                      {typeof c.page === 'number' && (
                        <Badge variant="outline" className="px-1 py-0 text-[10px]">
                          {m['compare.trace.page']({ page: c.page })}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </td>
              <td className="py-2 pr-4">{diffBadge(trace.diffLevel)}</td>
              <td className="py-2 pr-4 text-muted-foreground">{trace.diffNote || '—'}</td>
              <td className="py-2">
                <NoteCell trace={trace} editable={editable} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
