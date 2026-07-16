import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileUp, Loader2, Play, Plus, Square, X } from 'lucide-react';
import { m } from '@/paraglide/messages.js';
import { Link } from '@/core/i18n/navigation';
import { useSession } from '@/core/auth/client';
import { Header } from '@/blocks/header';
import { Footer } from '@/blocks/footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MarkdownContent } from '@/components/markdown-content';
import { cn } from '@/lib/utils';
import { apiFormData, apiGet, type PageResult } from '@/lib/api-client';
import { useCompareStream } from './-use-compare-stream';
import { TraceTable, type TraceRow } from './-trace-table';

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
  const [resultTab, setResultTab] = useState<'report' | 'traces'>('report');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { state, run, cancel } = useCompareStream();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(catalogSearch), 300);
    return () => clearTimeout(timer);
  }, [catalogSearch]);

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

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">{m['compare.form.title']()}</h1>
            <p className="mt-1 max-w-3xl text-muted-foreground">{m['compare.form.subtitle']()}</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
            {/* ── Form panel ── */}
            <div className="space-y-5">
              <Card>
                <CardContent className="space-y-5 pt-6">
                  <div className="space-y-2">
                    <Label>{m['compare.form.catalog_label']()}</Label>
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
                        <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-popover shadow-md">
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
                  </div>

                  <div className="space-y-2">
                    <Label>{m['compare.form.upload_label']()}</Label>
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
                        'flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-border py-5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground',
                        uploading && 'pointer-events-none opacity-60'
                      )}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleFiles(e.dataTransfer.files);
                      }}
                    >
                      {uploading ? (
                        <Loader2 className="size-5 animate-spin" />
                      ) : (
                        <FileUp className="size-5" />
                      )}
                      <span>{uploading ? m['compare.form.uploading']() : m['compare.form.upload_hint']()}</span>
                    </button>
                  </div>

                  {(parts.length > 0 || files.length > 0) && (
                    <div className="space-y-2">
                      <Label>
                        {m['compare.form.selected_chips']()} ({totalSelected}/{MAX_CHIPS})
                      </Label>
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
                          <Badge key={`${f.fileMd5}-${f.fileName}`} variant="outline" className="gap-1 font-mono">
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

                  <div className="space-y-2">
                    <Label>{m['compare.form.language_label']()}</Label>
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
                    <Label>{m['compare.form.prompt_label']()}</Label>
                    <Input
                      value={userPrompt}
                      onChange={(e) => setUserPrompt(e.target.value)}
                      placeholder={m['compare.form.prompt_placeholder']()}
                      maxLength={2000}
                    />
                  </div>

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
                </CardContent>
              </Card>
            </div>

            {/* ── Result panel ── */}
            <Card className="min-h-[480px]">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div className="flex gap-1 rounded-lg border border-border p-0.5">
                  {(['report', 'traces'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setResultTab(tab)}
                      className={cn(
                        'rounded-md px-3 py-1 text-sm transition-colors',
                        resultTab === tab
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {tab === 'report'
                        ? m['compare.report.tab_report']()
                        : m['compare.report.tab_traces']()}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {state.status === 'running' && (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>{state.stage || m['compare.stream.waiting']()}</span>
                    </>
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
              </CardHeader>
              <CardContent>
                {state.status === 'error' && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                    {state.error}
                  </div>
                )}
                {resultTab === 'report' ? (
                  <div ref={streamAreaRef} className="max-h-[70vh] overflow-y-auto">
                    {state.report ? (
                      <MarkdownContent content={state.report} />
                    ) : state.status === 'running' ? (
                      <p className="py-16 text-center text-sm text-muted-foreground">
                        {state.stage || m['compare.stream.waiting']()}
                      </p>
                    ) : state.status !== 'error' ? (
                      <p className="py-16 text-center text-sm text-muted-foreground">
                        {m['compare.form.subtitle']()}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <TraceTable traces={tracesQuery.data ?? []} editable={false} />
                )}
              </CardContent>
            </Card>
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
