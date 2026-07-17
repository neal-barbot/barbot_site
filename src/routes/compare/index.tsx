import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileUp, Loader2, Play, Plus, Square, X } from 'lucide-react';
import { m } from '@/paraglide/messages.js';
import { Link } from '@/core/i18n/navigation';
import { useSession } from '@/core/auth/client';
import { Header } from '@/blocks/header';
import { Footer } from '@/blocks/footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MarkdownContent } from '@/components/markdown-content';
import { MarkdownEditor } from '@/components/markdown-editor';
import { SubstitutionBadge } from '@/components/substitution-badge';
import { cn } from '@/lib/utils';
import { apiFormData, apiGet, apiPatch, type PageResult } from '@/lib/api-client';
import { useCompareStream } from './-use-compare-stream';
import { TraceTable, type TraceRow } from './-trace-table';
import { ParamMatrix } from './-param-matrix';
import { ChipChatPanel } from './-chip-chat';
import { EeDiagramPanel } from '@/blocks/ee-diagram-panel';

const LANGUAGES = [
  ['en', 'English'],
  ['zh', '中文'],
  ['ja', '日本語'],
  ['ko', '한국어'],
  ['de', 'Deutsch'],
  ['fr', 'Français'],
  ['es', 'Español'],
  ['pt', 'Português'],
] as const;

const MAX_CHIPS = 10;

interface CatalogChip {
  id: string;
  partNumber: string;
  manufacturer: string | null;
}

interface UploadedFile {
  fileMd5: string;
  fileName: string;
  pageCount: number;
  partNumber: string;
}

interface CompareSearch {
  part?: string;
}

type MainTab = 'report' | 'edit' | 'qa' | 'diagram';

/** Small-caps instrument section label — the page's typographic signature. */
function RailLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {children}
      </span>
      {right}
    </div>
  );
}

function ComparePage() {
  const { part: initialPart } = Route.useSearch();
  const { data: session } = useSession();

  const [parts, setParts] = useState<string[]>(initialPart ? [initialPart] : []);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [language, setLanguage] = useState('en');
  const [userPrompt, setUserPrompt] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>('report');
  const [resultTab, setResultTab] = useState<'report' | 'matrix' | 'traces'>('report');
  const [draft, setDraft] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { state, run, cancel } = useCompareStream();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(catalogSearch), 300);
    return () => clearTimeout(timer);
  }, [catalogSearch]);

  // Seed the markdown editor once a run completes.
  useEffect(() => {
    if (state.status === 'done' && state.report) setDraft(state.report);
  }, [state.status, state.report]);

  const costQuery = useQuery({
    queryKey: ['compare-cost'],
    queryFn: () => apiGet<{ costCredits: number }>('/api/chip-compare/cost'),
  });

  const searchQuery = useQuery({
    queryKey: ['compare-catalog-search', debouncedSearch],
    queryFn: () =>
      apiGet<PageResult<CatalogChip>>(
        `/api/chips?keyword=${encodeURIComponent(debouncedSearch)}&mode=fuzzy&page=1&pageSize=6`
      ),
    enabled: debouncedSearch.trim().length > 0,
  });

  const tracesQuery = useQuery({
    queryKey: ['compare-traces', state.recordId],
    queryFn: () => apiGet<TraceRow[]>(`/api/chip-compare/records/${state.recordId}/traces`),
    enabled: state.status === 'done' && !!state.recordId,
  });

  const recordMetaQuery = useQuery({
    queryKey: ['compare-record-meta', state.recordId],
    queryFn: () =>
      apiGet<{ substitutionLevel?: string }>(`/api/chip-compare/records/${state.recordId}`),
    enabled: state.status === 'done' && !!state.recordId,
  });

  const saveMutation = useMutation({
    mutationFn: () => apiPatch(`/api/chip-compare/records/${state.recordId}`, { result: draft }),
    onSuccess: () => toast.success(m['compare.edit.saved']()),
    onError: (e: Error) => toast.error(e.message),
  });


  const totalSelected = parts.length + files.length;
  const canRun = totalSelected >= 2 && totalSelected <= MAX_CHIPS && state.status !== 'running';

  function addPart(partNumber: string) {
    const norm = partNumber.trim();
    if (!norm || parts.includes(norm) || totalSelected >= MAX_CHIPS) return;
    setParts((prev) => [...prev, norm]);
    setCatalogSearch('');
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    if (!session?.user) {
      toast.error(m['compare.form.sign_in_required']());
      return;
    }
    const selected = Array.from(fileList).slice(0, MAX_CHIPS - totalSelected);
    if (!selected.length) return;

    setUploading(true);
    try {
      const formData = new FormData();
      for (const file of selected) formData.append('files', file);
      const result = await apiFormData<{
        files: Array<{ fileMd5: string; fileName: string; pageCount: number }>;
      }>('/api/chip-compare/upload', formData);

      setFiles((prev) => [
        ...prev,
        ...result.files
          .filter((f) => !prev.some((p) => p.fileMd5 === f.fileMd5 && p.fileName === f.fileName))
          .map((f) => ({
            ...f,
            partNumber: f.fileName.replace(/\.pdf$/i, ''),
          })),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : m['compare.form.upload_hint']());
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function startRun() {
    if (!session?.user) {
      toast.error(m['compare.form.sign_in_required']());
      return;
    }
    setMainTab('report');
    setResultTab('report');
    run({
      parts,
      files: files.map((f) => ({
        fileMd5: f.fileMd5,
        fileName: f.fileName,
        partNumber: f.partNumber,
      })),
      language,
      userPrompt: userPrompt.trim() || undefined,
    });
  }

  const streamAreaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status === 'running' && streamAreaRef.current) {
      streamAreaRef.current.scrollTop = streamAreaRef.current.scrollHeight;
    }
  }, [state.report, state.status]);

  const searchResults = useMemo(
    () =>
      (searchQuery.data?.items ?? []).filter((c) => !parts.includes(c.partNumber)),
    [searchQuery.data, parts]
  );

  const topTabs: Array<{ key: MainTab; label: string }> = [
    { key: 'report', label: m['compare.tabs.report']() },
    { key: 'edit', label: m['compare.tabs.edit']() },
    { key: 'qa', label: m['compare.tabs.qa']() },
    { key: 'diagram', label: m['compare.tabs.diagram']() },
  ];

  const emptySteps = [
    [m['compare.empty.step1_title'](), m['compare.empty.step1_desc']()],
    [m['compare.empty.step2_title'](), m['compare.empty.step2_desc']()],
    [m['compare.empty.step3_title'](), m['compare.empty.step3_desc']()],
  ] as const;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8">
          {/* ── Workbench toolbar ── */}
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b border-border">
            <div className="flex items-end gap-10">
              <h1 className="pb-3 text-xl font-semibold tracking-tight">
                {m['compare.form.title']()}
              </h1>
              <nav className="flex items-center gap-6 overflow-x-auto">
                {topTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setMainTab(tab.key)}
                    className={cn(
                      'whitespace-nowrap border-b-2 pb-3 text-sm transition-colors',
                      mainTab === tab.key
                        ? 'border-primary font-medium text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
                <Link
                  href="/settings/compare-history"
                  className="whitespace-nowrap border-b-2 border-transparent pb-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {m['compare.tabs.history']()}
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-3 pb-3 text-sm text-muted-foreground">
              {state.status === 'running' && (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin" />
                  {state.stage || m['compare.stream.waiting']()}
                </span>
              )}
              {state.status === 'done' && (
                <SubstitutionBadge level={recordMetaQuery.data?.substitutionLevel} />
              )}
              {state.status === 'done' && state.cacheHit && (
                <Badge variant="secondary">{m['compare.report.cache_hit']()}</Badge>
              )}
              {state.status === 'done' && state.recordId && (
                <Link
                  href={`/settings/compare-history/${state.recordId}`}
                  className="text-primary hover:underline"
                >
                  {m['compare.report.view_record']()}
                </Link>
              )}
            </div>
          </div>

          <div className="grid gap-10 pt-8 lg:grid-cols-[300px_1fr]">
            {/* ── Data source rail ── */}
            <aside className="space-y-7">
              <div className="space-y-4">
                <RailLabel>{m['compare.form.datasource']()}</RailLabel>

                <div className="relative">
                  <Input
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder={m['compare.form.catalog_placeholder']()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addPart(catalogSearch);
                      }
                    }}
                  />
                  {debouncedSearch.trim() && (
                    <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-md">
                      {searchQuery.isFetching ? (
                        <div className="p-3 text-sm text-muted-foreground">…</div>
                      ) : searchResults.length === 0 ? (
                        <button
                          className="flex w-full items-center gap-2 p-3 text-left text-sm hover:bg-accent"
                          onClick={() => addPart(catalogSearch)}
                        >
                          <Plus className="size-3.5" />
                          {m['compare.form.add']()} “{catalogSearch.trim()}”
                        </button>
                      ) : (
                        searchResults.map((c) => (
                          <button
                            key={c.id}
                            className="flex w-full items-center justify-between p-2.5 text-left text-sm hover:bg-accent"
                            onClick={() => addPart(c.partNumber)}
                          >
                            <span className="font-mono">{c.partNumber}</span>
                            <span className="text-xs text-muted-foreground">
                              {c.manufacturer || ''}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <button
                  className={cn(
                    'flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed py-6 text-sm transition-colors',
                    dragOver
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                    uploading && 'pointer-events-none opacity-60'
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    handleFiles(e.dataTransfer.files);
                  }}
                >
                  {uploading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <FileUp className="size-5" />
                  )}
                  <span className="px-4 leading-snug">
                    {uploading ? m['compare.form.uploading']() : m['compare.form.upload_hint']()}
                  </span>
                </button>

                {/* Confirm action lives with the data sources, not at the rail's tail */}
                {state.status === 'running' ? (
                  <Button className="w-full" variant="outline" onClick={cancel}>
                    <Square className="size-4" />
                    {m['compare.stream.cancel']()}
                  </Button>
                ) : (
                  <Button className="w-full" disabled={!canRun} onClick={startRun}>
                    <Play className="size-4" />
                    {m['compare.form.run']()}
                  </Button>
                )}
                <p className="text-center text-xs text-muted-foreground">
                  {totalSelected < 2
                    ? m['compare.form.min_chips']()
                    : m['compare.form.cost_hint']({
                        credits: costQuery.data?.costCredits ?? '…',
                      })}
                </p>
              </div>

              {(parts.length > 0 || files.length > 0) && (
                <div className="space-y-3 border-t border-border pt-6">
                  <RailLabel
                    right={
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {totalSelected}/{MAX_CHIPS}
                      </span>
                    }
                  >
                    {m['compare.form.selected_chips']()}
                  </RailLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {parts.map((p) => (
                      <Badge key={p} variant="secondary" className="gap-1 font-mono">
                        {p}
                        <button onClick={() => setParts((prev) => prev.filter((x) => x !== p))}>
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                    {files.map((f) => (
                      <Badge
                        key={`${f.fileMd5}-${f.fileName}`}
                        variant="outline"
                        className="gap-1 font-mono"
                      >
                        {f.partNumber}
                        <span className="text-[10px] text-muted-foreground">
                          {m['compare.form.file_pages']({ pages: f.pageCount })}
                        </span>
                        <button
                          onClick={() =>
                            setFiles((prev) =>
                              prev.filter(
                                (x) => !(x.fileMd5 === f.fileMd5 && x.fileName === f.fileName)
                              )
                            )
                          }
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4 border-t border-border pt-6">
                <RailLabel>{m['compare.form.output_settings']()}</RailLabel>
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">
                    {m['compare.form.language_label']()}
                  </span>
                  <Select value={language} onValueChange={(v) => setLanguage(v ?? 'en')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">
                    {m['compare.form.prompt_label']()}
                  </span>
                  <Input
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    placeholder={m['compare.form.prompt_placeholder']()}
                    maxLength={2000}
                  />
                </div>
              </div>
            </aside>

            {/* ── Main panel ── */}
            <section
              key={mainTab}
              className="min-h-[520px] duration-200 animate-in fade-in slide-in-from-bottom-1 lg:border-l lg:border-border lg:pl-10"
            >
              {mainTab === 'report' ? (
                <div>
                  {(state.report || state.status !== 'idle') && (
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-5">
                        {(['report', 'matrix', 'traces'] as const).map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setResultTab(tab)}
                            className={cn(
                              'text-sm transition-colors',
                              resultTab === tab
                                ? 'font-medium text-foreground underline decoration-primary decoration-2 underline-offset-8'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            {tab === 'report'
                              ? m['compare.report.tab_report']()
                              : tab === 'matrix'
                                ? m['compare.matrix.tab']()
                                : m['compare.report.tab_traces']()}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {state.status === 'running' && (
                    <div className="mb-5 h-0.5 w-full overflow-hidden rounded bg-primary/15">
                      <div className="h-full w-1/3 animate-pulse rounded bg-primary" />
                    </div>
                  )}

                  {state.status === 'error' && (
                    <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                      {state.error}
                    </div>
                  )}

                  {resultTab === 'report' ? (
                    <div ref={streamAreaRef} className="max-h-[72vh] overflow-y-auto pr-1">
                      {state.report ? (
                        <MarkdownContent content={state.report} />
                      ) : state.status === 'running' ? (
                        <p className="py-16 text-sm text-muted-foreground">
                          {state.stage || m['compare.stream.waiting']()}
                        </p>
                      ) : state.status !== 'error' ? (
                        <div className="max-w-lg pt-10">
                          <p className="text-lg font-medium">{m['compare.empty.title']()}</p>
                          <ol className="mt-8 space-y-7">
                            {emptySteps.map(([title, desc], i) => (
                              <li key={title} className="flex gap-5">
                                <span className="mt-0.5 font-mono text-sm tabular-nums text-muted-foreground/60">
                                  0{i + 1}
                                </span>
                                <div>
                                  <p className="font-medium">{title}</p>
                                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                    {desc}
                                  </p>
                                </div>
                              </li>
                            ))}
                          </ol>
                        </div>
                      ) : null}
                    </div>
                  ) : resultTab === 'matrix' ? (
                    <ParamMatrix traces={tracesQuery.data ?? []} />
                  ) : (
                    <TraceTable traces={tracesQuery.data ?? []} editable={false} />
                  )}
                </div>
              ) : mainTab === 'edit' ? (
                <div>
                  <div className="mb-5 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {state.recordId && state.status === 'done'
                        ? m['compare.tabs.edit']()
                        : ''}
                    </span>
                    <Button
                      size="sm"
                      disabled={!state.recordId || state.status !== 'done' || saveMutation.isPending}
                      onClick={() => saveMutation.mutate()}
                    >
                      {saveMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
                      {m['compare.edit.save']()}
                    </Button>
                  </div>
                  {state.recordId && state.status === 'done' ? (
                    <MarkdownEditor value={draft} onChange={setDraft} />
                  ) : (
                    <p className="pt-10 text-sm text-muted-foreground">
                      {m['compare.edit.empty_hint']()}
                    </p>
                  )}
                </div>
              ) : mainTab === 'qa' ? (
                <div className="flex h-[72vh] min-h-[440px] flex-col overflow-hidden rounded-lg border border-border">
                  <ChipChatPanel recordId={state.recordId} className="flex-1" />
                </div>
              ) : (
                <EeDiagramPanel />
              )}
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export const Route = createFileRoute('/compare/')({
  validateSearch: (search: Record<string, unknown>): CompareSearch => ({
    part: typeof search.part === 'string' ? search.part : undefined,
  }),
  component: ComparePage,
});
