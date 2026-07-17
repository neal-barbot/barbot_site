// Split-view markdown source editor (editor.md-style): textarea source on
// the left, live preview on the right. Chosen over the Tiptap rich-text
// editor for comparison reports because they are table-heavy — GFM tables
// survive source editing byte-for-byte, while a WYSIWYG round-trip without
// table support would destroy them.

import { useRef, useState } from 'react';
import {
  Bold,
  Columns2,
  Eye,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  PenLine,
  Table,
} from 'lucide-react';
import { m } from '@/paraglide/messages.js';
import { MarkdownContent } from '@/components/markdown-content';
import { cn } from '@/lib/utils';

type Mode = 'edit' | 'split' | 'preview';

const TABLE_SNIPPET = [
  '| 参数 | 芯片 A | 芯片 B | 差异 |',
  '| :--- | :--- | :--- | :--- |',
  '|  |  |  |  |',
  '',
].join('\n');

export function MarkdownEditor({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  const [mode, setMode] = useState<Mode>('split');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /** Wrap the selection (or insert a placeholder) and keep focus. */
  function apply(before: string, after = '', placeholder = '') {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const selected = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  /** Insert a block snippet on its own line at the cursor. */
  function insertBlock(snippet: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const needsNewline = start > 0 && value[start - 1] !== '\n';
    const inserted = (needsNewline ? '\n' : '') + snippet;
    onChange(value.slice(0, start) + inserted + value.slice(start));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + inserted.length, start + inserted.length);
    });
  }

  const tools = [
    { icon: Bold, title: 'Bold', action: () => apply('**', '**', 'text') },
    { icon: Italic, title: 'Italic', action: () => apply('*', '*', 'text') },
    { icon: Heading2, title: 'H2', action: () => insertBlock('## ') },
    { icon: Heading3, title: 'H3', action: () => insertBlock('### ') },
    { icon: List, title: 'List', action: () => insertBlock('- ') },
    { icon: Table, title: 'Table', action: () => insertBlock(TABLE_SNIPPET) },
    { icon: LinkIcon, title: 'Link', action: () => apply('[', '](https://)', 'link') },
  ] as const;

  const modes: Array<{ key: Mode; icon: typeof PenLine; label: string }> = [
    { key: 'edit', icon: PenLine, label: m['compare.editor.mode_edit']() },
    { key: 'split', icon: Columns2, label: m['compare.editor.mode_split']() },
    { key: 'preview', icon: Eye, label: m['compare.editor.mode_preview']() },
  ];

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border', className)}>
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-2 py-1.5">
        <div className="flex items-center gap-0.5">
          {tools.map((tool) => (
            <button
              key={tool.title}
              type="button"
              title={tool.title}
              onClick={tool.action}
              className="grid size-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <tool.icon className="size-4" />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5">
          {modes.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setMode(item.key)}
              className={cn(
                'flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors',
                mode === item.key
                  ? 'bg-background font-medium text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className="size-3.5" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className={cn('grid', mode === 'split' && 'lg:grid-cols-2')}>
        {mode !== 'preview' && (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            className={cn(
              'h-[64vh] min-h-[420px] w-full resize-none bg-background p-4 font-mono text-[13px] leading-relaxed outline-none',
              mode === 'split' && 'lg:border-r lg:border-border'
            )}
          />
        )}
        {mode !== 'edit' && (
          <div className="h-[64vh] min-h-[420px] overflow-y-auto p-4">
            <MarkdownContent content={value} />
          </div>
        )}
      </div>
    </div>
  );
}
