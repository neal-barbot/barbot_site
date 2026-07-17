// SVG renderer for EE functional block diagrams. Input is the structured
// graph emitted by the diagram module; layout is a simple left-to-right
// layered arrangement (longest-path ranking), which matches EE reading
// conventions (power/inputs left, control center, outputs right).

import { useMemo, useRef } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface DiagramBlock {
  id: string;
  label: string;
  sub?: string | null;
  group?: string | null;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string | null;
  dashed?: boolean | null;
}

export interface DiagramData {
  title?: string;
  blocks: DiagramBlock[];
  edges: DiagramEdge[];
}

const BLOCK_W = 176;
const BLOCK_H = 64;
const COL_GAP = 120;
const ROW_GAP = 36;
const PADDING = 32;

const GROUP_COLORS = [
  'oklch(0.62 0.17 255)', // blue
  'oklch(0.65 0.15 150)', // green
  'oklch(0.7 0.15 70)', // amber
  'oklch(0.62 0.19 20)', // red
  'oklch(0.6 0.16 300)', // purple
  'oklch(0.65 0.12 200)', // teal
];

interface Placed extends DiagramBlock {
  x: number;
  y: number;
  color: string;
}

function layout(data: DiagramData): {
  placed: Map<string, Placed>;
  width: number;
  height: number;
} {
  const ids = data.blocks.map((b) => b.id);
  const rank = new Map<string, number>(ids.map((id) => [id, 0]));

  // Longest-path ranking with a fixed iteration cap (tolerates cycles).
  for (let pass = 0; pass < data.blocks.length; pass++) {
    let changed = false;
    for (const edge of data.edges) {
      const next = (rank.get(edge.from) ?? 0) + 1;
      if (next > (rank.get(edge.to) ?? 0) && next < data.blocks.length) {
        rank.set(edge.to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const columns = new Map<number, DiagramBlock[]>();
  for (const block of data.blocks) {
    const r = rank.get(block.id) ?? 0;
    columns.set(r, [...(columns.get(r) ?? []), block]);
  }

  const groupNames = [...new Set(data.blocks.map((b) => b.group || ''))];
  const colorFor = (group?: string | null) =>
    GROUP_COLORS[Math.max(0, groupNames.indexOf(group || '')) % GROUP_COLORS.length];

  const sortedRanks = [...columns.keys()].sort((a, b) => a - b);
  const maxRows = Math.max(...[...columns.values()].map((c) => c.length));
  const height = PADDING * 2 + maxRows * BLOCK_H + (maxRows - 1) * ROW_GAP + 40;

  const placed = new Map<string, Placed>();
  sortedRanks.forEach((r, columnIndex) => {
    const column = columns.get(r)!;
    // Keep same-group blocks adjacent within the column.
    column.sort((a, b) => (a.group || '').localeCompare(b.group || ''));
    const columnHeight = column.length * BLOCK_H + (column.length - 1) * ROW_GAP;
    const startY = (height - columnHeight) / 2;
    column.forEach((block, rowIndex) => {
      placed.set(block.id, {
        ...block,
        x: PADDING + columnIndex * (BLOCK_W + COL_GAP),
        y: startY + rowIndex * (BLOCK_H + ROW_GAP),
        color: colorFor(block.group),
      });
    });
  });

  const width = PADDING * 2 + sortedRanks.length * BLOCK_W + (sortedRanks.length - 1) * COL_GAP;
  return { placed, width, height };
}

export function BlockDiagram({ data, className }: { data: DiagramData; className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { placed, width, height } = useMemo(() => layout(data), [data]);

  function downloadSvg() {
    const node = svgRef.current;
    if (!node) return;
    const clone = node.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const blob = new Blob([clone.outerHTML], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${(data.title || 'ee-block-diagram').replace(/\s+/g, '-')}.svg`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium">{data.title}</p>
        <Button variant="outline" size="sm" onClick={downloadSvg}>
          <Download className="size-3.5" />
          SVG
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-white p-2 dark:bg-neutral-900">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          style={{ maxWidth: '100%', height: 'auto', fontFamily: 'ui-sans-serif, system-ui' }}
        >
          <defs>
            <marker id="bd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#64748b" />
            </marker>
          </defs>

          {/* edges under blocks */}
          {data.edges.map((edge, i) => {
            const a = placed.get(edge.from);
            const b = placed.get(edge.to);
            if (!a || !b) return null;
            const x1 = a.x + BLOCK_W;
            const y1 = a.y + BLOCK_H / 2;
            const x2 = b.x;
            const y2 = b.y + BLOCK_H / 2;
            const backward = x2 <= x1;
            const midX = backward ? x1 + 24 : (x1 + x2) / 2;
            const d = backward
              ? `M ${a.x + BLOCK_W / 2} ${a.y + BLOCK_H} V ${Math.max(y1, y2) + BLOCK_H / 2 + 14} H ${b.x + BLOCK_W / 2} V ${b.y + BLOCK_H}`
              : `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
            return (
              <g key={i}>
                <path
                  d={d}
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="1.4"
                  strokeDasharray={edge.dashed ? '5 4' : undefined}
                  markerEnd="url(#bd-arrow)"
                />
                {edge.label && (
                  <text
                    x={backward ? (a.x + b.x + BLOCK_W) / 2 : midX}
                    y={backward ? Math.max(y1, y2) + BLOCK_H / 2 + 10 : (y1 + y2) / 2 - 6}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#475569"
                    style={{ paintOrder: 'stroke', stroke: 'white', strokeWidth: 3 }}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* blocks */}
          {[...placed.values()].map((block) => (
            <g key={block.id}>
              <rect
                x={block.x}
                y={block.y}
                width={BLOCK_W}
                height={BLOCK_H}
                rx="8"
                fill="white"
                stroke={block.color}
                strokeWidth="1.6"
              />
              <rect x={block.x} y={block.y} width="5" height={BLOCK_H} rx="2.5" fill={block.color} />
              <text
                x={block.x + BLOCK_W / 2 + 2}
                y={block.y + (block.sub ? 26 : BLOCK_H / 2 + 4)}
                textAnchor="middle"
                fontSize="13"
                fontWeight="600"
                fill="#0f172a"
              >
                {block.label.slice(0, 24)}
              </text>
              {block.sub && (
                <text
                  x={block.x + BLOCK_W / 2 + 2}
                  y={block.y + 44}
                  textAnchor="middle"
                  fontSize="10.5"
                  fill="#64748b"
                >
                  {block.sub.slice(0, 28)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
