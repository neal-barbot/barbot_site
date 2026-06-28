import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Brain,
  ChevronRight,
  Crosshair,
  FileText,
  Image as ImageIcon,
  LibraryBig,
  Loader2,
  Maximize2,
  MessageCircle,
  MousePointer2,
  PanelRight,
  Plus,
  RotateCcw,
  Search,
  Send,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { MarkdownContent } from '@/components/markdown-content';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiGet, apiPost } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';

type WikiContextType = 'concept' | 'source' | 'output';

interface WikiContextItem {
  id: string;
  type: WikiContextType;
  title: string;
  summary: string;
  path: string;
  updated?: string;
  imageCount: number;
  images: Array<{
    name: string;
    url: string;
  }>;
}

interface WikiAnswer {
  answer: string;
  contextMarkdown: string;
  trace?: {
    id: string;
    path: string;
  };
  citations: Array<{
    title: string;
    path: string;
  }>;
}

interface WikiContextDetail {
  id: string;
  type: WikiContextType;
  title: string;
  path: string;
  content: string;
}

interface DiagramSelection {
  x: number;
  y: number;
  width: number;
  height: number;
}

function WikiImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [objectUrl, setObjectUrl] = useState('');

  useEffect(() => {
    let active = true;
    let nextUrl = '';

    fetch(src)
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load image');
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        nextUrl = URL.createObjectURL(blob);
        setObjectUrl(nextUrl);
      })
      .catch(() => {
        if (active) setObjectUrl('');
      });

    return () => {
      active = false;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [src]);

  if (!objectUrl) {
    return (
      <div className={cn('flex items-center justify-center bg-muted text-xs text-muted-foreground', className)}>
        {m['settings.wiki.loading']()}
      </div>
    );
  }

  return <img src={objectUrl} alt={alt} className={className} />;
}

function DiagramStudyCanvas({
  image,
  selection,
  onSelectionChange,
}: {
  image?: { name: string; url: string };
  selection: DiagramSelection | null;
  onSelectionChange: (selection: DiagramSelection | null) => void;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [objectUrl, setObjectUrl] = useState('');
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [transform, setTransform] = useState({ x: 24, y: 24, scale: 0.6 });
  const [tool, setTool] = useState<'pan' | 'select'>('select');
  const [drag, setDrag] = useState<null | {
    type: 'pan' | 'select';
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
  }>(null);

  useEffect(() => {
    let active = true;
    let nextUrl = '';
    setObjectUrl('');
    setNaturalSize({ width: 0, height: 0 });
    onSelectionChange(null);

    if (!image) return;

    fetch(image.url)
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load image');
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        nextUrl = URL.createObjectURL(blob);
        setObjectUrl(nextUrl);
      })
      .catch(() => {
        if (active) setObjectUrl('');
      });

    return () => {
      active = false;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [image?.url]);

  const fitToScreen = (width = naturalSize.width, height = naturalSize.height) => {
    const viewport = viewportRef.current;
    if (!viewport || !width || !height) return;
    const rect = viewport.getBoundingClientRect();
    const scale = Math.min((rect.width - 48) / width, (rect.height - 48) / height, 1.25);
    setTransform({
      scale,
      x: Math.max(24, (rect.width - width * scale) / 2),
      y: Math.max(24, (rect.height - height * scale) / 2),
    });
  };

  const clientToImage = (event: PointerEvent<HTMLDivElement>) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.max(0, (event.clientX - rect.left - transform.x) / transform.scale),
      y: Math.max(0, (event.clientY - rect.top - transform.y) / transform.scale),
    };
  };

  const zoomBy = (factor: number) => {
    setTransform((current) => ({
      ...current,
      scale: Math.min(4, Math.max(0.15, current.scale * factor)),
    }));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!objectUrl) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer events in automated tests may not have an active
      // pointer capture target. Selection still works without capture.
    }
    const point = clientToImage(event);
    setDrag({
      type: tool,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: point.x,
      startY: point.y,
      startPanX: transform.x,
      startPanY: transform.y,
    });
    if (tool === 'select') {
      onSelectionChange({ x: point.x, y: point.y, width: 1, height: 1 });
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;

    if (drag.type === 'pan') {
      setTransform((current) => ({
        ...current,
        x: drag.startPanX + event.clientX - drag.startClientX,
        y: drag.startPanY + event.clientY - drag.startClientY,
      }));
      return;
    }

    const point = clientToImage(event);
    const x = Math.min(drag.startX, point.x);
    const y = Math.min(drag.startY, point.y);
    const width = Math.abs(point.x - drag.startX);
    const height = Math.abs(point.y - drag.startY);
    onSelectionChange({
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(Math.max(1, width)),
      height: Math.round(Math.max(1, height)),
    });
  };

  const onPointerUp = () => {
    setDrag(null);
  };

  return (
    <div className="flex h-[640px] min-h-[520px] flex-col overflow-hidden rounded-sm border border-border bg-white">
      <div className="flex h-11 items-center justify-between border-b border-border bg-card px-3">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={tool === 'select' ? 'default' : 'ghost'}
            className="h-8 rounded-sm px-2"
            onClick={() => setTool('select')}
          >
            <Crosshair className="size-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tool === 'pan' ? 'default' : 'ghost'}
            className="h-8 rounded-sm px-2"
            onClick={() => setTool('pan')}
          >
            <MousePointer2 className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" size="sm" variant="ghost" className="h-8 rounded-sm px-2" onClick={() => zoomBy(1.2)}>
            <ZoomIn className="size-4" />
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 rounded-sm px-2" onClick={() => zoomBy(0.82)}>
            <ZoomOut className="size-4" />
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 rounded-sm px-2" onClick={() => fitToScreen()}>
            <Maximize2 className="size-4" />
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 rounded-sm px-2" onClick={() => onSelectionChange(null)}>
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </div>
      <div
        ref={viewportRef}
        className={cn(
          'relative min-h-0 flex-1 touch-none overflow-hidden bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border))_1px,transparent_0)] [background-size:18px_18px]',
          tool === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {objectUrl ? (
          <>
            <img
              src={objectUrl}
              alt={image?.name ?? ''}
              draggable={false}
              onLoad={(event) => {
                const img = event.currentTarget;
                setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
                fitToScreen(img.naturalWidth, img.naturalHeight);
              }}
              className="absolute left-0 top-0 max-w-none select-none"
              style={{
                width: naturalSize.width || undefined,
                height: naturalSize.height || undefined,
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                transformOrigin: '0 0',
              }}
            />
            {selection ? (
              <div
                className="pointer-events-none absolute border-2 border-primary bg-primary/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.10)]"
                style={{
                  left: transform.x + selection.x * transform.scale,
                  top: transform.y + selection.y * transform.scale,
                  width: selection.width * transform.scale,
                  height: selection.height * transform.scale,
                }}
              />
            ) : null}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {m['settings.wiki.loading']()}
          </div>
        )}
      </div>
    </div>
  );
}

function WikiAssistantPage() {
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<WikiAnswer | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selection, setSelection] = useState<DiagramSelection | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'diagram' | 'context'>('overview');
  const [loadingStep, setLoadingStep] = useState(0);

  const contextsQuery = useQuery({
    queryKey: ['wiki-contexts'],
    queryFn: () => apiGet<WikiContextItem[]>('/api/wiki/contexts'),
  });

  const contexts = contextsQuery.data ?? [];
  const selectedContexts = contexts.filter((item) => selectedIds.includes(item.id));

  const filteredContexts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return contexts;
    return contexts.filter((item) => {
      return [item.title, item.summary, item.path, item.type]
        .join(' ')
        .toLowerCase()
        .includes(normalized);
    });
  }, [contexts, query]);

  const featuredContext =
    selectedContexts[0] ??
    filteredContexts.find((item) => item.images.length > 0) ??
    filteredContexts[0];
  const activeImage = featuredContext?.images[activeImageIndex] ?? featuredContext?.images[0];

  const contextDetailQuery = useQuery({
    queryKey: ['wiki-context-detail', featuredContext?.id],
    queryFn: () =>
      apiGet<WikiContextDetail>(`/api/wiki/context?id=${encodeURIComponent(featuredContext?.id ?? '')}`),
    enabled: !!featuredContext?.id,
  });

  const contextDetail = contextDetailQuery.data;
  const articleContent = useMemo(() => {
    return (contextDetail?.content ?? '')
      .replace(/^---[\s\S]*?---\s*/m, '')
      .replace(/\[\[([^\]]+)\]\]/g, '$1');
  }, [contextDetail?.content]);

  const articleHeadings = useMemo(() => {
    return articleContent
      .split('\n')
      .map((line) => line.match(/^(#{2,3})\s+(.+)$/))
      .filter(Boolean)
      .map((match) => ({
        level: match![1].length,
        title: match![2].replace(/[`*_]/g, ''),
      }))
      .slice(0, 8);
  }, [articleContent]);

  const loadingMessages = [
    '正在生成 context.md',
    '正在调用 pi-agent',
    '正在等待模型回答',
    '正在保存可回放 trace',
  ];

  const askMutation = useMutation({
    mutationFn: (payload: { question: string; mode?: string }) =>
      apiPost<WikiAnswer>('/api/wiki/ask', {
        question: payload.question,
        contextIds: selectedIds.length > 0 ? selectedIds : featuredContext ? [featuredContext.id] : [],
        imageName: activeImage?.name,
        selection,
        mode: payload.mode ?? 'diagram_focus',
    }),
    onSuccess: (data) => {
      setAnswer(data);
      if (data.trace?.id) {
        toast.success(`Trace saved: ${data.trace.id}`);
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!askMutation.isPending) {
      setLoadingStep(0);
      return;
    }

    const timer = window.setInterval(() => {
      setLoadingStep((current) => (current + 1) % loadingMessages.length);
    }, 1400);

    return () => window.clearInterval(timer);
  }, [askMutation.isPending, loadingMessages.length]);

  const toggleContext = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const submitQuestion = () => {
    if (!question.trim() || askMutation.isPending) return;
    askMutation.mutate({ question });
  };

  const askQuickQuestion = (nextQuestion: string) => {
    if (askMutation.isPending) return;
    setQuestion(nextQuestion);
    askMutation.mutate({ question: nextQuestion, mode: 'diagram_focus' });
  };

  const typeLabel = (type: WikiContextType) => {
    if (type === 'concept') return m['settings.wiki.type_concept']();
    if (type === 'source') return m['settings.wiki.type_source']();
    return m['settings.wiki.type_output']();
  };

  return (
    <div className="h-[calc(100vh-1rem)] overflow-hidden bg-background">
      {askMutation.isPending ? (
        <div className="fixed right-6 top-6 z-50 w-[320px] rounded-sm border border-border bg-card p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-9 items-center justify-center rounded-sm bg-primary text-primary-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">pi-agent 调用中</div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">
                {loadingMessages[loadingStep]}
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${((loadingStep + 1) / loadingMessages.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="grid h-full grid-cols-1 border-border bg-background lg:grid-cols-[minmax(0,1fr)_430px]">
        <main className="min-h-0 overflow-hidden border-border lg:border-r">
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-border bg-card">
              <div className="flex h-12 items-center justify-between px-4 md:px-6">
                <h1 className="truncate text-lg font-semibold tracking-tight md:text-xl">
                  {featuredContext?.title ?? m['settings.wiki.title']()}
                </h1>
                <Button size="sm" className="h-8 rounded-sm" onClick={() => setActiveTab('diagram')}>
                  {m['settings.wiki.block_diagram']()}
                </Button>
              </div>
              <div className="flex h-11 items-center gap-5 border-t border-border px-4 text-sm md:px-6">
                <button
                  className={cn('font-medium', activeTab === 'overview' ? 'text-primary' : 'text-foreground')}
                  onClick={() => setActiveTab('overview')}
                >
                  {m['settings.wiki.tab_overview']()}
                </button>
                <button
                  className={cn('border-l border-border pl-5 font-medium', activeTab === 'diagram' ? 'text-primary' : 'text-muted-foreground')}
                  onClick={() => setActiveTab('diagram')}
                >
                  {m['settings.wiki.tab_diagram']()}
                </button>
                <button
                  className={cn('border-l border-border pl-5 font-medium', activeTab === 'context' ? 'text-primary' : 'text-muted-foreground')}
                  onClick={() => setActiveTab('context')}
                >
                  {m['settings.wiki.tab_context']()}
                </button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)]">
              <aside className="min-h-0 overflow-y-auto border-b border-border bg-muted/25 md:border-b-0 md:border-r">
                <div className="sticky top-0 z-10 border-b border-border bg-card p-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={m['settings.wiki.search_placeholder']()}
                      className="h-9 rounded-sm bg-background pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-1 p-2">
                  {filteredContexts.map((item) => {
                    const selected = selectedIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveImageIndex(0);
                          setSelection(null);
                          toggleContext(item.id);
                        }}
                        className={cn(
                          'group flex w-full items-start gap-2 rounded-sm border border-transparent px-2.5 py-2.5 text-left transition hover:bg-accent',
                          selected && 'border-border bg-accent'
                        )}
                      >
                        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-sm bg-background text-muted-foreground">
                          {item.imageCount > 0 ? <ImageIcon className="size-4" /> : <FileText className="size-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="rounded-sm px-1 py-0 text-[10px]">
                              {typeLabel(item.type)}
                            </Badge>
                            {item.imageCount > 0 ? (
                              <span className="text-[10px] text-muted-foreground">{item.imageCount} img</span>
                            ) : null}
                          </div>
                          <div className="mt-1 line-clamp-2 text-xs font-medium leading-5">
                            {item.title}
                          </div>
                        </div>
                        <ChevronRight className="mt-2 size-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                      </button>
                    );
                  })}
                </div>
              </aside>

              <section className="min-h-0 overflow-y-auto bg-background">
                <div className="px-6 py-7">
                  {featuredContext ? (
                    <>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <BookOpen className="size-4" />
                        <span>{featuredContext.path}</span>
                      </div>
                      <h2 className="mt-5 border-b border-border pb-5 text-2xl font-medium tracking-tight">
                        {featuredContext.title}
                      </h2>
                      {activeTab === 'overview' ? (
                        <div className="mt-5 grid gap-8 xl:grid-cols-[minmax(0,760px)_260px]">
                          <article className="min-h-[620px] rounded-sm bg-background px-1 py-2">
                            {contextDetailQuery.isFetching ? (
                              <div className="py-20 text-center text-sm text-muted-foreground">
                                {m['settings.wiki.loading']()}
                              </div>
                            ) : (
                              <MarkdownContent content={articleContent || featuredContext.summary} className="text-[17px] leading-8" />
                            )}
                          </article>
                          <aside className="hidden xl:block">
                            <div className="sticky top-6 border-l border-border pl-5">
                              <div className="text-sm font-medium">{m['settings.wiki.explore_here']()}</div>
                              <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                                {(articleHeadings.length > 0 ? articleHeadings : [
                                  { level: 2, title: m['settings.wiki.context_hint']() },
                                  { level: 2, title: m['settings.wiki.tab_diagram']() },
                                  { level: 2, title: m['settings.wiki.feynman_coach']() },
                                ]).map((heading, index) => (
                                  <div key={`${heading.title}-${index}`} className={heading.level === 3 ? 'pl-3' : ''}>
                                    {heading.title}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </aside>
                        </div>
                      ) : activeTab === 'diagram' ? (
                        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
                          <div>
                            {activeImage ? (
                              <DiagramStudyCanvas
                                image={activeImage}
                                selection={selection}
                                onSelectionChange={setSelection}
                              />
                            ) : (
                              <div className="flex min-h-[520px] items-center justify-center rounded-sm border border-border p-8 text-center">
                                <div className="max-w-md">
                                  <FileText className="mx-auto size-10 text-muted-foreground" />
                                  <p className="mt-4 text-sm leading-7 text-muted-foreground">
                                    {featuredContext.summary || m['settings.wiki.no_summary']()}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="space-y-3">
                            <div className="rounded-sm border border-border bg-card p-4">
                              <div className="text-sm font-medium">{m['settings.wiki.context_hint']()}</div>
                              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                                {featuredContext.summary || m['settings.wiki.context_description']()}
                              </p>
                            </div>
                            {featuredContext.images.length > 1 ? (
                              <div className="rounded-sm border border-border bg-card p-3">
                                <div className="mb-2 text-xs font-medium text-muted-foreground">
                                  {m['settings.wiki.image_gallery']()}
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  {featuredContext.images.map((image, index) => (
                                    <button
                                      key={image.url}
                                      type="button"
                                      onClick={() => {
                                        setActiveImageIndex(index);
                                        setSelection(null);
                                      }}
                                      className={cn(
                                        'aspect-square overflow-hidden rounded-sm border bg-background p-1',
                                        activeImageIndex === index ? 'border-primary' : 'border-border'
                                      )}
                                    >
                                      <WikiImage src={image.url} alt={image.name} className="size-full object-cover" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                            <Button
                              type="button"
                              variant={selectedIds.includes(featuredContext.id) ? 'secondary' : 'default'}
                              className="w-full rounded-sm"
                              onClick={() => toggleContext(featuredContext.id)}
                            >
                              {selectedIds.includes(featuredContext.id)
                                ? m['settings.wiki.remove_context']()
                                : m['settings.wiki.add_context']()}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                          <div className="rounded-sm border border-border bg-card p-5">
                            <div className="text-sm font-medium">{m['settings.wiki.context_hint']()}</div>
                            <p className="mt-3 text-sm leading-7 text-muted-foreground">
                              {m['settings.wiki.context_description']()}
                            </p>
                          </div>
                          <div className="rounded-sm border border-border bg-card p-5">
                            <div className="text-sm font-medium">{m['settings.wiki.current_focus']()}</div>
                            <div className="mt-3 text-sm leading-7 text-muted-foreground">
                              {activeImage?.name ?? m['settings.wiki.no_image_selected']()}
                            </div>
                            <div className="mt-2 text-sm leading-7 text-muted-foreground">
                              {selection
                                ? `x=${selection.x}, y=${selection.y}, w=${selection.width}, h=${selection.height}`
                                : m['settings.wiki.no_selection']()}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex min-h-[480px] items-center justify-center text-sm text-muted-foreground">
                      {contextsQuery.isFetching ? m['settings.wiki.loading']() : m['settings.wiki.empty']()}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </main>

        <aside className="flex min-h-0 flex-col bg-card">
          <div className="flex h-14 items-center justify-between border-b border-border px-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <PanelRight className="size-4" />
              {m['settings.wiki.feynman_coach']()}
            </div>
            <Badge variant="secondary" className="rounded-sm">
              {selectedIds.length} context
            </Badge>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
              {featuredContext ? (
                <div className="mb-5 rounded-sm border border-border bg-background p-4">
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    {m['settings.wiki.current_focus']()}
                  </div>
                  <div className="mt-2 line-clamp-2 text-sm font-medium">{featuredContext.title}</div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {activeImage?.name ?? m['settings.wiki.no_image_selected']()}
                  </div>
                  <div className="mt-3 rounded-sm bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                    {selection
                      ? `x=${selection.x}, y=${selection.y}, w=${selection.width}, h=${selection.height}`
                      : m['settings.wiki.no_selection']()}
                  </div>
                </div>
              ) : null}

              <div className="mb-5 grid grid-cols-2 gap-2">
                {[
                  m['settings.wiki.quick_what'](),
                  m['settings.wiki.quick_why'](),
                  m['settings.wiki.quick_alternative'](),
                  m['settings.wiki.quick_risk'](),
                ].map((item) => (
                  <Button
                    key={item}
                    type="button"
                    variant="outline"
                    className="h-auto justify-start whitespace-normal rounded-sm px-3 py-2 text-left text-xs leading-5"
                    disabled={askMutation.isPending || !featuredContext}
                    onClick={() => askQuickQuestion(item)}
                  >
                    {item}
                  </Button>
                ))}
              </div>

              {answer ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Brain className="size-4" />
                    {m['settings.wiki.answer']()}
                  </div>
                  <MarkdownContent content={answer.answer} className="text-sm" />
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase text-muted-foreground">
                      {m['settings.wiki.citations']()}
                    </div>
                    {answer.citations.map((citation) => (
                      <div key={citation.path} className="rounded-md border border-border p-3 text-xs">
                        <div className="font-medium">{citation.title}</div>
                        <div className="mt-1 text-muted-foreground">{citation.path}</div>
                      </div>
                    ))}
                  </div>
                  <details className="rounded-md border border-border p-3">
                    <summary className="cursor-pointer text-xs font-medium">
                      {m['settings.wiki.context_md']()}
                    </summary>
                    <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs leading-5">
                      {answer.contextMarkdown}
                    </pre>
                  </details>
                </div>
              ) : (
                <div className="flex min-h-[360px] items-center justify-center text-center">
                  <div>
                    <MessageCircle className="mx-auto size-8 text-muted-foreground" />
                    <p className="mt-4 text-lg font-medium">{m['settings.wiki.start_title']()}</p>
                    <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
                      {m['settings.wiki.feynman_start_description']()}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border p-4">
              <div className="mb-3 flex flex-wrap gap-2">
                {selectedContexts.length > 0 ? (
                  selectedContexts.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleContext(item.id)}
                      className="inline-flex max-w-full items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                    >
                      <FileText className="size-3" />
                      <span className="max-w-48 truncate">{item.title}</span>
                      <X className="size-3" />
                    </button>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">{m['settings.wiki.no_context_selected']()}</span>
                )}
              </div>
              <div className="flex items-end gap-2">
                <Textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder={m['settings.wiki.question_placeholder']()}
                  className="min-h-20 resize-none"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                      submitQuestion();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  className="mb-0.5 shrink-0"
                  disabled={askMutation.isPending || !question.trim()}
                  onClick={submitQuestion}
                  aria-label={m['settings.wiki.ask']()}
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/settings/wiki-assistant')({
  component: WikiAssistantPage,
});
