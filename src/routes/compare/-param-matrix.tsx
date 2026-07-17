import { useMemo } from 'react';
import { m } from '@/paraglide/messages.js';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TraceRow } from './-trace-table';

interface ChipValue {
  chip?: string;
  value?: string;
  page?: number | null;
}

const DIFF_ROW_CLASS: Record<string, string> = {
  critical: 'bg-destructive/10',
  significant: 'bg-orange-500/10',
  minor: 'bg-muted/40',
};

/**
 * Structured comparison view: one row per parameter, one column per chip,
 * pivoted from the trace rows.
 */
export function ParamMatrix({ traces }: { traces: TraceRow[] }) {
  const { chips, groups } = useMemo(() => {
    const chipSet = new Set<string>();
    const parsed = traces.map((trace) => {
      let values: ChipValue[] = [];
      try {
        values = JSON.parse(trace.chipsTrace);
      } catch {
        values = [];
      }
      for (const v of values) if (v.chip) chipSet.add(v.chip);
      return { trace, values };
    });

    const byCategory = new Map<string, typeof parsed>();
    for (const row of parsed) {
      const category = row.trace.paramCategory || '—';
      if (!byCategory.has(category)) byCategory.set(category, []);
      byCategory.get(category)!.push(row);
    }

    return { chips: [...chipSet], groups: [...byCategory.entries()] };
  }, [traces]);

  if (traces.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{m['compare.trace.empty']()}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2 pr-4 font-medium">{m['compare.trace.col_param']()}</th>
            {chips.map((c) => (
              <th key={c} className="py-2 pr-4 font-mono font-medium text-foreground">
                {c}
              </th>
            ))}
            <th className="py-2 font-medium">{m['compare.trace.col_diff_level']()}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(([category, rows]) => (
            <>
              <tr key={`cat-${category}`}>
                <td
                  colSpan={chips.length + 2}
                  className="pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {category}
                </td>
              </tr>
              {rows.map(({ trace, values }) => (
                <tr
                  key={trace.id}
                  className={cn('border-b border-border/50', DIFF_ROW_CLASS[trace.diffLevel ?? ''] ?? '')}
                >
                  <td className="py-2 pr-4 font-medium">
                    {trace.paramName}
                    {trace.diffNote && (
                      <p className="mt-0.5 text-xs font-normal text-muted-foreground">{trace.diffNote}</p>
                    )}
                  </td>
                  {chips.map((c) => {
                    const v = values.find((x) => x.chip === c);
                    return (
                      <td key={c} className="py-2 pr-4 font-mono">
                        {v?.value ?? '—'}
                        {typeof v?.page === 'number' && (
                          <Badge variant="outline" className="ml-1.5 px-1 py-0 text-[10px]">
                            {m['compare.trace.page']({ page: v.page })}
                          </Badge>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-2">
                    <span
                      className={cn(
                        'text-xs',
                        trace.diffLevel === 'critical' && 'font-semibold text-destructive',
                        trace.diffLevel === 'significant' && 'font-medium text-orange-600 dark:text-orange-400',
                        (!trace.diffLevel || trace.diffLevel === 'none') && 'text-muted-foreground'
                      )}
                    >
                      {trace.diffLevel ?? '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
