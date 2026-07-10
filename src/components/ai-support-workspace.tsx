import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, ExternalLink, FileUp, Loader2, Play, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFormData, apiGet, apiPatch, apiPost, apiPut } from '@/lib/api-client';

type Page =
  | 'dashboard' | 'installation' | 'sdk' | 'history' | 'leads'
  | 'custom-responses' | 'text-snippets' | 'website-links' | 'files' | 'sync-jobs'
  | 'starters' | 'followups' | 'instructions' | 'persona' | 'localization' | 'appearance'
  | 'human-support' | 'settings';

type Chatbot = { id: string; name: string; description: string; publicKey: string; status: string; allowedDomains: string };
type Source = { id: string; type: string; title: string; content: string | null; sourceUrl: string | null; status: string; updatedAt: string; metadata: string };
type SyncJob = { sourceId: string; title: string; status: string; attempts: number; lastError: string | null; lastSyncedAt: string | null };
type Conversation = { id: string; lastMessage: string; status: string; feedback: string | null; updatedAt: string; contactName: string | null; contactEmail: string | null };
type Lead = { id: string; name: string | null; email: string | null; status: string; priority: string; createdAt: string };
type Escalation = { id: string; status: string; summary: string; conversationId: string | null; createdAt: string };

const pageMeta: Record<Page, { title: string; description: string }> = {
  dashboard: { title: 'Chatbot Dashboard', description: 'Operational status, knowledge readiness, and support activity.' },
  installation: { title: 'Installation', description: 'Embed this chatbot and verify it on an approved site.' },
  sdk: { title: 'SDK (Advanced)', description: 'Control the widget from your application without exposing secrets.' },
  history: { title: 'Chat History', description: 'Inspect, resolve, and follow up on customer conversations.' },
  leads: { title: 'Leads', description: 'Qualify captured contacts and prioritize the next human action.' },
  'custom-responses': { title: 'Custom Responses', description: 'Deterministic answers take priority over generated answers.' },
  'text-snippets': { title: 'Text Snippets', description: 'Add concise, reference-only knowledge for the chatbot.' },
  'website-links': { title: 'Website Links', description: 'Fetch approved public pages into the knowledge base.' },
  files: { title: 'Files & Data Sources', description: 'Upload supported documents for parsing and retrieval.' },
  'sync-jobs': { title: 'Auto Sync Jobs', description: 'Run and inspect knowledge synchronization jobs.' },
  starters: { title: 'Conversation Starters', description: 'Initial quick prompts shown before a visitor sends a message.' },
  followups: { title: 'Conversation Followups', description: 'Suggested next steps shown after answers.' },
  instructions: { title: 'Chatbot Instructions', description: 'Versioned response boundaries and fallback behavior.' },
  persona: { title: 'Chatbot Persona', description: 'Versioned tone, role, and writing style.' },
  localization: { title: 'Language & Region', description: 'Default locale, timezone, and widget text overrides.' },
  appearance: { title: 'Appearance', description: 'Brand the visitor-facing widget.' },
  'human-support': { title: 'Human Support', description: 'Escalation prompts, confirmation copy, and notifications.' },
  settings: { title: 'Settings', description: 'Chatbot identity, allowed domains, and lifecycle state.' },
};

function CopyButton({ value }: { value: string }) {
  return <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(value).then(() => toast.success('Copied'))}><Copy className="size-4" />Copy</Button>;
}

function JsonSettings({ chatbotId, kind }: { chatbotId: string; kind: 'starters' | 'followups' }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['conversation-buttons', chatbotId, kind], queryFn: () => apiGet<unknown[]>(`/api/ai-support/conversation-buttons?chatbotId=${chatbotId}&kind=${kind}`) });
  const [value, setValue] = useState('');
  const effectiveValue = value || JSON.stringify(query.data ?? [], null, 2);
  const mutation = useMutation({
    mutationFn: () => apiPut('/api/ai-support/conversation-buttons', { chatbotId, kind, buttons: JSON.parse(effectiveValue) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['conversation-buttons', chatbotId, kind] }); setValue(''); toast.success('Published new version'); },
    onError: (error: Error) => toast.error(error.message),
  });
  return <Card><CardContent className="space-y-3 pt-6"><Textarea className="min-h-72 font-mono text-xs" value={effectiveValue} onChange={(event) => setValue(event.target.value)} /><Button onClick={() => mutation.mutate()} disabled={mutation.isPending}><Save className="size-4" />Save buttons</Button></CardContent></Card>;
}

export function AiSupportWorkspacePage({ chatbotId, page }: { chatbotId: string; page: Page }) {
  const queryClient = useQueryClient();
  const meta = pageMeta[page];
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [provider, setProvider] = useState('native');
  const [crawlMode, setCrawlMode] = useState('scrape');
  const [file, setFile] = useState<File | null>(null);
  const chatbots = useQuery({ queryKey: ['ai-chatbots'], queryFn: () => apiGet<Chatbot[]>('/api/ai-support/chatbots') });
  const chatbot = chatbots.data?.find((item) => item.id === chatbotId);
  const sourceType = page === 'custom-responses' ? 'custom_response' : page === 'text-snippets' ? 'text_snippet' : page === 'website-links' ? 'website_link' : page === 'files' ? 'file' : undefined;
  const sources = useQuery({ queryKey: ['knowledge-sources', chatbotId, sourceType], queryFn: () => apiGet<Source[]>(`/api/ai-support/knowledge-sources?chatbotId=${chatbotId}${sourceType ? `&type=${sourceType}` : ''}`), enabled: Boolean(sourceType) });
  const conversations = useQuery({ queryKey: ['conversations', chatbotId], queryFn: () => apiGet<Conversation[]>(`/api/ai-support/conversations?chatbotId=${chatbotId}`), enabled: page === 'history' || page === 'dashboard' });
  const leads = useQuery({ queryKey: ['leads', chatbotId], queryFn: () => apiGet<Lead[]>(`/api/ai-support/leads?chatbotId=${chatbotId}`), enabled: page === 'leads' || page === 'dashboard' });
  const jobs = useQuery({ queryKey: ['sync-jobs', chatbotId], queryFn: () => apiGet<SyncJob[]>(`/api/ai-support/sync-jobs?chatbotId=${chatbotId}`), enabled: page === 'sync-jobs' || page === 'dashboard' });

  const createSource = useMutation({
    mutationFn: () => apiPost<Source>('/api/ai-support/knowledge-sources', {
      chatbotId, type: sourceType, title, content, sourceUrl: url,
      metadata: page === 'website-links' ? { provider, mode: crawlMode } : {},
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['knowledge-sources', chatbotId] }); setTitle(''); setContent(''); setUrl(''); setProvider('native'); setCrawlMode('scrape'); toast.success('Knowledge source created'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const syncSource = useMutation({
    mutationFn: (source: Source) => source.type === 'website_link'
      ? apiPost('/api/ai-support/knowledge-sync', { sourceId: source.id })
      : apiPost('/api/ai-support/sync-jobs', { sourceId: source.id }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['knowledge-sources', chatbotId] }); queryClient.invalidateQueries({ queryKey: ['sync-jobs', chatbotId] }); toast.success('Sync queued'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a file first');
      const data = new FormData(); data.append('chatbotId', chatbotId); data.append('file', file);
      return apiFormData('/api/ai-support/knowledge-upload', data);
    },
    onSuccess: () => { setFile(null); queryClient.invalidateQueries({ queryKey: ['knowledge-sources', chatbotId] }); toast.success('File uploaded and queued'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const resolveConversation = useMutation({ mutationFn: (id: string) => apiPatch('/api/ai-support/conversations', { id, status: 'resolved' }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations', chatbotId] }) });
  const leadStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => apiPatch('/api/ai-support/leads', { id, status }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads', chatbotId] }) });

  const installationCode = useMemo(() => chatbot ? `<script src="${typeof window === 'undefined' ? '' : window.location.origin}/ai-support-widget.js"\n  data-ai-support-public-key="${chatbot.publicKey}"></script>` : '', [chatbot]);

  const body = (() => {
    if (page === 'dashboard') return <div className="grid gap-4 md:grid-cols-3"><Card><CardHeader><CardDescription>Conversations</CardDescription><CardTitle>{conversations.data?.length ?? 0}</CardTitle></CardHeader></Card><Card><CardHeader><CardDescription>Leads</CardDescription><CardTitle>{leads.data?.length ?? 0}</CardTitle></CardHeader></Card><Card><CardHeader><CardDescription>Sync jobs</CardDescription><CardTitle>{jobs.data?.length ?? 0}</CardTitle></CardHeader></Card></div>;
    if (page === 'installation') return <Card><CardContent className="space-y-4 pt-6"><Label>JavaScript embed</Label><Textarea readOnly className="min-h-32 font-mono text-xs" value={installationCode} /><div className="flex gap-2"><CopyButton value={installationCode} /><Button variant="outline" onClick={() => window.open('/ai-support-widget.js', '_blank')}><ExternalLink className="size-4" />Widget script</Button></div><p className="text-sm text-muted-foreground">For iframe use the public widget endpoint; for inline mode initialize the same script inside your target container.</p></CardContent></Card>;
    if (page === 'sdk') return <Card><CardContent className="space-y-4 pt-6"><Textarea readOnly className="min-h-72 font-mono text-xs" value={`window.$sitegpt.open();\nwindow.$sitegpt.close();\nwindow.$sitegpt.sendMessage('How can I upgrade?');\nwindow.$sitegpt.identifyUser({ id: 'user_123', email: 'user@example.com' });\nwindow.$sitegpt.setMetadata({ plan: 'pro' });`} /><p className="text-sm text-muted-foreground">Identify users only from your server-signed application session. Do not send production secrets to the browser.</p></CardContent></Card>;
    if (page === 'history') return <Card><CardContent className="space-y-3 pt-6">{conversations.data?.map((item) => <div className="flex items-center justify-between gap-3 border-b py-3" key={item.id}><div><p className="font-medium">{item.lastMessage || 'New conversation'}</p><p className="text-xs text-muted-foreground">{item.contactEmail || item.contactName || 'Anonymous'} · {item.status}</p></div><Button size="sm" variant="outline" onClick={() => resolveConversation.mutate(item.id)} disabled={item.status === 'resolved'}><Check className="size-4" />Resolve</Button></div>)}</CardContent></Card>;
    if (page === 'leads') return <Card><CardContent className="space-y-3 pt-6">{leads.data?.map((item) => <div className="flex items-center justify-between gap-3 border-b py-3" key={item.id}><div><p className="font-medium">{item.name || 'Unknown lead'}</p><p className="text-xs text-muted-foreground">{item.email || 'No email'} · {item.priority}</p></div><select className="rounded border bg-background px-2 py-1 text-sm" value={item.status} onChange={(event) => leadStatus.mutate({ id: item.id, status: event.target.value })}>{['new','qualified','contacted','closed','spam'].map((status) => <option key={status}>{status}</option>)}</select></div>)}</CardContent></Card>;
    if (page === 'files') return <Card><CardContent className="space-y-4 pt-6"><Input type="file" accept=".pdf,.txt,.md,.markdown,.csv,.docx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><p className="text-sm text-muted-foreground">PDF, TXT, Markdown, CSV, and DOCX up to 20MB.</p><Button onClick={() => upload.mutate()} disabled={!file || upload.isPending}>{upload.isPending && <Loader2 className="size-4 animate-spin" />}<FileUp className="size-4" />Upload and index</Button>{sources.data?.map((source) => <SourceRow source={source} onSync={syncSource.mutate} key={source.id} />)}</CardContent></Card>;
    if (page === 'sync-jobs') return <Card><CardContent className="space-y-3 pt-6">{jobs.data?.map((job) => <div className="flex items-center justify-between gap-3 border-b py-3" key={job.sourceId}><div><p className="font-medium">{job.title}</p><p className="text-xs text-muted-foreground">{job.status} · attempts {job.attempts}{job.lastError ? ` · ${job.lastError}` : ''}</p></div><Button size="sm" variant="outline" onClick={() => apiPost('/api/ai-support/sync-jobs', { sourceId: job.sourceId }).then(() => jobs.refetch())}><Play className="size-4" />Run</Button></div>)}</CardContent></Card>;
    if (page === 'starters' || page === 'followups') return <JsonSettings chatbotId={chatbotId} kind={page} />;
    if (page === 'instructions' || page === 'persona') return <PromptPanel chatbotId={chatbotId} field={page} />;
    if (page === 'localization') return <LocalizationPanel chatbotId={chatbotId} />;
    if (page === 'appearance') return <AppearancePanel chatbotId={chatbotId} />;
    if (page === 'human-support') return <HumanSupportPanel chatbotId={chatbotId} />;
    if (page === 'settings') return <ChatbotSettings chatbot={chatbot} />;
    return <><Card><CardContent className="space-y-3 pt-6"><Input placeholder="Title or question" value={title} onChange={(event) => setTitle(event.target.value)} />{page === 'website-links' ? <><Input placeholder="https://example.com/help" value={url} onChange={(event) => setUrl(event.target.value)} /><div className="grid gap-3 sm:grid-cols-2"><div><Label>Crawler</Label><select className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" value={provider} onChange={(event) => setProvider(event.target.value)}><option value="native">Built-in fetch</option><option value="firecrawl">Firecrawl</option><option value="context_dev">Context.dev</option></select></div><div><Label>Mode</Label><select className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" value={crawlMode} onChange={(event) => setCrawlMode(event.target.value)}><option value="scrape">Single page</option><option value="crawl">Website crawl</option></select></div></div></> : <Textarea placeholder={page === 'custom-responses' ? 'Answer' : 'Reference content'} value={content} onChange={(event) => setContent(event.target.value)} />}<Button onClick={() => createSource.mutate()} disabled={!title || createSource.isPending}><Save className="size-4" />Add source</Button></CardContent></Card><Card><CardContent className="space-y-2 pt-6">{sources.data?.map((source) => <SourceRow source={source} onSync={syncSource.mutate} key={source.id} />)}</CardContent></Card></>;
  })();

  return <div className="space-y-6 p-4 md:p-6"><div><h1 className="text-2xl font-semibold">{meta.title}</h1><p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>{chatbot && <p className="mt-2 text-xs text-muted-foreground">{chatbot.name} · {chatbot.status}</p>}</div>{body}</div>;
}

function SourceRow({ source, onSync }: { source: Source; onSync: (source: Source) => void }) {
  return <div className="flex items-center justify-between gap-3 border-b py-3"><div className="min-w-0"><p className="truncate font-medium">{source.title}</p><p className="truncate text-xs text-muted-foreground">{source.status} · {source.sourceUrl || source.content?.slice(0, 90) || 'No content'}</p></div><Button size="sm" variant="outline" onClick={() => onSync(source)}><Play className="size-4" />Sync</Button></div>;
}

function PromptPanel({ chatbotId, field }: { chatbotId: string; field: 'instructions' | 'persona' }) {
  const queryClient = useQueryClient(); const query = useQuery({ queryKey: ['prompt-persona', chatbotId], queryFn: () => apiGet<{ instructions: string; persona: string }>(`/api/ai-support/prompt-persona?chatbotId=${chatbotId}`) }); const [value, setValue] = useState(''); const current = value || query.data?.[field] || ''; const mutation = useMutation({ mutationFn: () => apiPatch('/api/ai-support/prompt-persona', { chatbotId, settings: { [field]: current } }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['prompt-persona', chatbotId] }); setValue(''); toast.success('Published version'); } }); return <Card><CardContent className="space-y-3 pt-6"><Textarea className="min-h-80" value={current} onChange={(event) => setValue(event.target.value)} /><Button onClick={() => mutation.mutate()}><Save className="size-4" />Publish</Button></CardContent></Card>;
}

function LocalizationPanel({ chatbotId }: { chatbotId: string }) { const queryClient = useQueryClient(); const query = useQuery({ queryKey: ['localization', chatbotId], queryFn: () => apiGet<unknown>(`/api/ai-support/localization?chatbotId=${chatbotId}`) }); const [value, setValue] = useState(''); const current = value || JSON.stringify(query.data ?? { defaultLocale: 'en', timezone: 'UTC', autoDetectLocale: true, labels: {} }, null, 2); const mutation = useMutation({ mutationFn: () => apiPut('/api/ai-support/localization', { chatbotId, settings: JSON.parse(current) }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['localization', chatbotId] }); setValue(''); toast.success('Published localization'); } }); return <Card><CardContent className="space-y-3 pt-6"><Textarea className="min-h-80 font-mono text-xs" value={current} onChange={(event) => setValue(event.target.value)} /><Button onClick={() => mutation.mutate()}><Save className="size-4" />Publish</Button></CardContent></Card>; }

function AppearancePanel({ chatbotId }: { chatbotId: string }) { const queryClient = useQueryClient(); const query = useQuery({ queryKey: ['appearance', chatbotId], queryFn: () => apiGet<Record<string, string>>(`/api/ai-support/widget-appearance?chatbotId=${chatbotId}`) }); const [value, setValue] = useState(''); const current = value || JSON.stringify(query.data ?? {}, null, 2); const mutation = useMutation({ mutationFn: () => apiPatch('/api/ai-support/widget-appearance', { chatbotId, settings: JSON.parse(current) }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['appearance', chatbotId] }); setValue(''); toast.success('Published appearance'); } }); return <Card><CardContent className="space-y-3 pt-6"><Textarea className="min-h-80 font-mono text-xs" value={current} onChange={(event) => setValue(event.target.value)} /><Button onClick={() => mutation.mutate()}><Save className="size-4" />Publish</Button></CardContent></Card>; }

function HumanSupportPanel({ chatbotId }: { chatbotId: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['human-support', chatbotId], queryFn: () => apiGet<Record<string, unknown>>(`/api/ai-support/human-support-settings?chatbotId=${chatbotId}`) });
  const escalations = useQuery({ queryKey: ['escalations', chatbotId], queryFn: () => apiGet<Escalation[]>(`/api/ai-support/escalations?chatbotId=${chatbotId}`) });
  const [value, setValue] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const current = value || JSON.stringify(query.data ?? {}, null, 2);
  const mutation = useMutation({ mutationFn: () => apiPatch('/api/ai-support/human-support-settings', { chatbotId, settings: JSON.parse(current) }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['human-support', chatbotId] }); setValue(''); toast.success('Published human support settings'); } });
  const reply = useMutation({ mutationFn: (input: { escalationId: string; content: string }) => apiPost('/api/ai-support/support-replies', input), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['escalations', chatbotId] }); toast.success('Reply sent to the widget conversation'); } });
  return <div className="space-y-4"><Card><CardContent className="space-y-3 pt-6"><Textarea className="min-h-64 font-mono text-xs" value={current} onChange={(event) => setValue(event.target.value)} /><Button onClick={() => mutation.mutate()}><Save className="size-4" />Publish settings</Button></CardContent></Card><Card><CardHeader><CardTitle>Open support queue</CardTitle><CardDescription>Human replies are delivered to the visitor widget. Agent drafts still require manual review.</CardDescription></CardHeader><CardContent className="space-y-4">{escalations.data?.filter((item) => item.status !== 'closed').map((item) => <div key={item.id} className="space-y-2 border-b pb-4"><p className="font-medium">{item.summary || 'Human support request'}</p><Textarea value={drafts[item.id] || ''} placeholder="Write the approved human reply" onChange={(event) => setDrafts({ ...drafts, [item.id]: event.target.value })} /><Button size="sm" onClick={() => reply.mutate({ escalationId: item.id, content: drafts[item.id] || '' })} disabled={!drafts[item.id]?.trim() || reply.isPending}>Send reply</Button></div>)}</CardContent></Card></div>;
}

function ChatbotSettings({ chatbot }: { chatbot?: Chatbot }) { const queryClient = useQueryClient(); const [name, setName] = useState(''); const [domains, setDomains] = useState(''); const mutation = useMutation({ mutationFn: () => apiPatch('/api/ai-support/chatbots', { id: chatbot?.id, name: name || chatbot?.name, allowedDomains: domains ? domains.split(',').map((item) => item.trim()).filter(Boolean) : undefined }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ai-chatbots'] }); toast.success('Chatbot settings saved'); } }); if (!chatbot) return null; return <Card><CardContent className="space-y-3 pt-6"><Label>Name</Label><Input value={name || chatbot.name} onChange={(event) => setName(event.target.value)} /><Label>Allowed domains</Label><Input value={domains} placeholder="example.com, app.example.com" onChange={(event) => setDomains(event.target.value)} /><Button onClick={() => mutation.mutate()}><Save className="size-4" />Save</Button></CardContent></Card>; }
