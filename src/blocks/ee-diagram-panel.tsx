// EE block-diagram generator panel — shared by the standalone /diagram page
// and the compare workbench tab. Owns its inputs (description, engine,
// output language) and renders the result via BlockDiagram or <img>.

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Play } from 'lucide-react';
import { m } from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';
import { apiPost } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BlockDiagram, type DiagramData } from '@/components/block-diagram';

type DiagramResult =
  | { engine: 'svg'; diagram: DiagramData }
  | { engine: 'image'; url: string };

export function EeDiagramPanel({ className }: { className?: string }) {
  const [description, setDescription] = useState('');
  const [engine, setEngine] = useState<'svg' | 'image'>('svg');
  const [result, setResult] = useState<DiagramResult | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      apiPost<DiagramResult>('/api/chip-compare/diagram', {
        description: description.trim(),
        language: getLocale(),
        engine,
      }),
    onSuccess: (data) => setResult(data),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className={cn('space-y-5', className)}>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={m['compare.diagram.desc_placeholder']()}
        maxLength={2000}
        className="h-24 w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary/50"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          {(['svg', 'image'] as const).map((eng) => (
            <button
              key={eng}
              onClick={() => setEngine(eng)}
              className={cn(
                'rounded-md px-3 py-1 text-sm transition-colors',
                engine === eng
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {eng === 'svg'
                ? m['compare.diagram.engine_svg']()
                : m['compare.diagram.engine_image']()}
            </button>
          ))}
        </div>
        <Button
          disabled={description.trim().length < 4 || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Play className="size-4" />
          )}
          {mutation.isPending
            ? m['compare.diagram.generating']()
            : m['compare.diagram.generate']()}
        </Button>
      </div>

      {result?.engine === 'svg' ? (
        <BlockDiagram data={result.diagram} />
      ) : result?.engine === 'image' ? (
        <div>
          <div className="mb-3 flex justify-end">
            <a href={result.url} download className="text-sm text-primary hover:underline">
              PNG ↓
            </a>
          </div>
          <img src={result.url} alt="" className="w-full rounded-lg border border-border" />
        </div>
      ) : !mutation.isPending ? (
        <div className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">{m['compare.diagram.empty_hint']()}</p>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {m['compare.diagram.examples_label']()}
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['compare.diagram.example_bms_label', 'compare.diagram.example_bms_text'],
                  ['compare.diagram.example_mcu_label', 'compare.diagram.example_mcu_text'],
                  ['compare.diagram.example_motor_label', 'compare.diagram.example_motor_text'],
                  ['compare.diagram.example_iot_label', 'compare.diagram.example_iot_text'],
                  ['compare.diagram.example_coffee_label', 'compare.diagram.example_coffee_text'],
                  ['compare.diagram.example_bio_label', 'compare.diagram.example_bio_text'],
                ] as const
              ).map(([labelKey, textKey]) => (
                <button
                  key={labelKey}
                  onClick={() => setDescription(m[textKey]())}
                  className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  {m[labelKey]()}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
