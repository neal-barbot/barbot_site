import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Bot,
  Braces,
  CheckCircle2,
  Clipboard,
  CreditCard,
  DatabaseZap,
  Download,
  FileText,
  Globe2,
  Headphones,
  History,
  KeyRound,
  LockKeyhole,
  Plus,
  Rocket,
  MessageSquare,
  Palette,
  PlugZap,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { apiGet, apiPatch, apiPost } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';

type StatusTone = 'ready' | 'warning' | 'blocked';

type Metric = {
  label: string;
  value: string;
  description: string;
  icon: typeof Bot;
};

type LaunchItem = {
  label: string;
  description: string;
  status: StatusTone;
};

type SourceItem = {
  label: string;
  kind: string;
  status: StatusTone;
  detail: string;
};

type AgentPolicy = {
  label: string;
  scope: string;
  access: string;
  approval: string;
};

type FeatureCard = {
  label: string;
  description: string;
  icon: typeof Bot;
  status: StatusTone;
};

type OverviewMetricKey = 'chatbots' | 'knowledge' | 'leads' | 'agent_actions';
type OverviewChecklistKey =
  | 'chatbot'
  | 'installation'
  | 'knowledge'
  | 'human_support'
  | 'agent_control'
  | 'production_ops'
  | 'versioning';
type OverviewSourceType = 'custom_response' | 'text_snippet' | 'website_link' | 'file';

type AiSupportOverview = {
  readiness: number;
  metrics: Array<{ key: OverviewMetricKey; value: number; status: StatusTone }>;
  checklist: Array<{ key: OverviewChecklistKey; status: StatusTone }>;
  knowledgeSources: Array<{
    type: OverviewSourceType;
    total: number;
    ready: number;
    needsReview: number;
  }>;
  pendingApprovals: number;
};

type AiChatbot = {
  id: string;
  name: string;
  description: string;
  status: string;
  installStatus: string;
  publicKey: string;
  allowedDomains: string;
  createdAt: string;
};

type InstallationCheckResult = {
  url: string;
  normalizedUrl: string;
  installed: boolean;
  installStatus: string;
  statusCode: number | null;
  reason: string;
  detectedPublicKey: string | null;
  checkedAt: string;
};

type AiKnowledgeSource = {
  id: string;
  chatbotId: string;
  type: OverviewSourceType;
  title: string;
  status: string;
  sourceUrl: string | null;
  updatedAt: string;
};

type AiLead = {
  id: string;
  chatbotId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  priority: string;
  createdAt: string;
};

type AiEscalation = {
  id: string;
  chatbotId: string;
  status: string;
  assigneeUserId: string | null;
  summary: string;
  metadata: string;
  createdAt: string;
};

type AiConversation = {
  id: string;
  chatbotId: string;
  status: string;
  sourceUrl: string | null;
  visitorId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  lastMessage: string;
  messageCount: number;
  feedback: string | null;
  createdAt: string;
  updatedAt: string;
};

type AiConversationMessage = {
  id: string;
  role: string;
  content: string;
  citations: string;
  feedback: string | null;
  createdAt: string;
};

type AiConversationWithMessages = AiConversation & {
  messages: AiConversationMessage[];
};

type AiAgentToken = {
  id: string;
  name: string;
  status: string;
  accessProfile: string;
  scopes: string[];
  chatbotIds: string[];
  tokenPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
};

type AiAgentRun = {
  id: string;
  chatbotId: string | null;
  agentTokenId: string | null;
  action: string;
  status: string;
  approvalRequired: boolean;
  summary: string;
  diff: string | null;
  createdAt: string;
  completedAt: string | null;
};

type AiConfigVersion = {
  id: string;
  chatbotId: string;
  settingKey: string;
  status: string;
  version: number;
  content: string;
  createdByType: string;
  createdById: string | null;
  approvedByUserId: string | null;
  createdAt: string;
  publishedAt: string | null;
};

type HumanSupportSettings = {
  enabled: boolean;
  showEscalationButtons: boolean;
  replaceSuggestions: boolean;
  positivePrompt: string;
  requestPrompt: string;
  confirmationMessage: string;
  notificationsEnabled: boolean;
  notificationEmail: string;
  notificationWebhookUrl: string;
};

type WidgetAppearanceSettings = {
  displayName: string;
  welcomeMessage: string;
  placeholder: string;
  launcherLabel: string;
  primaryColor: string;
};

type LaunchOperationsSettings = {
  backupConfigured: boolean;
  backupRunbookUrl: string;
  errorAlertsEnabled: boolean;
  errorAlertWebhookUrl: string;
  logRetentionDays: number;
  rateLimitEnabled: boolean;
  domainWhitelistRequired: boolean;
};

type AiSupportUsage = {
  generatedAt: string;
  resetAt: string;
  totals: {
    chatbots: number;
    installedChatbots: number;
    knowledgeSources: number;
    readyKnowledgeSources: number;
    conversations: number;
    messages: number;
    leads: number;
    escalations: number;
    openEscalations: number;
    activeAgentTokens: number;
    pendingApprovals: number;
    auditEvents: number;
  };
  byChatbot: Array<{
    chatbotId: string;
    name: string;
    status: string;
    installStatus: string;
    knowledgeSources: number;
    conversations: number;
    messages: number;
    leads: number;
    escalations: number;
    openEscalations: number;
  }>;
};

type AiAuditLog = {
  id: string;
  actorType: string;
  actorId: string;
  resourceType: string;
  resourceId: string;
  action: string;
  requiresApproval: boolean;
  status: string;
  createdAt: string;
};

const toneStyles: Record<StatusTone, string> = {
  ready: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300',
  warning: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300',
  blocked: 'border-destructive/25 bg-destructive/10 text-destructive',
};

const metricMeta: Record<OverviewMetricKey, Omit<Metric, 'value'>> = {
  chatbots: {
    label: m['settings.ai_support.metric_chatbots'](),
    description: m['settings.ai_support.metric_chatbots_desc'](),
    icon: Bot,
  },
  knowledge: {
    label: m['settings.ai_support.metric_knowledge'](),
    description: m['settings.ai_support.metric_knowledge_desc'](),
    icon: DatabaseZap,
  },
  leads: {
    label: m['settings.ai_support.metric_handoffs'](),
    description: m['settings.ai_support.metric_handoffs_desc'](),
    icon: Headphones,
  },
  agent_actions: {
    label: m['settings.ai_support.metric_agent_actions'](),
    description: m['settings.ai_support.metric_agent_actions_desc'](),
    icon: Sparkles,
  },
};

const launchMeta: Record<OverviewChecklistKey, Omit<LaunchItem, 'status'>> = {
  chatbot: {
    label: m['settings.ai_support.launch_install'](),
    description: m['settings.ai_support.launch_install_desc'](),
  },
  installation: {
    label: m['settings.ai_support.launch_install'](),
    description: m['settings.ai_support.launch_install_desc'](),
  },
  knowledge: {
    label: m['settings.ai_support.launch_knowledge'](),
    description: m['settings.ai_support.launch_knowledge_desc'](),
  },
  human_support: {
    label: m['settings.ai_support.launch_human'](),
    description: m['settings.ai_support.launch_human_desc'](),
  },
  agent_control: {
    label: m['settings.ai_support.launch_agent'](),
    description: m['settings.ai_support.launch_agent_desc'](),
  },
  production_ops: {
    label: m['settings.ai_support.launch_production'](),
    description: m['settings.ai_support.launch_production_desc'](),
  },
  versioning: {
    label: m['settings.ai_support.launch_security'](),
    description: m['settings.ai_support.launch_security_desc'](),
  },
};

const sourceMeta: Record<OverviewSourceType, Omit<SourceItem, 'status'>> = {
  custom_response: {
    label: m['settings.ai_support.source_custom'](),
    kind: m['settings.ai_support.source_custom_kind'](),
    detail: m['settings.ai_support.source_custom_detail'](),
  },
  text_snippet: {
    label: m['settings.ai_support.source_text'](),
    kind: m['settings.ai_support.source_text_kind'](),
    detail: m['settings.ai_support.source_text_detail'](),
  },
  website_link: {
    label: m['settings.ai_support.source_links'](),
    kind: m['settings.ai_support.source_links_kind'](),
    detail: m['settings.ai_support.source_links_detail'](),
  },
  file: {
    label: m['settings.ai_support.source_files'](),
    kind: m['settings.ai_support.source_files_kind'](),
    detail: m['settings.ai_support.source_files_detail'](),
  },
};

function StatusBadge({ status }: { status: StatusTone }) {
  const label =
    status === 'ready'
      ? m['settings.ai_support.status_ready']()
      : status === 'warning'
        ? m['settings.ai_support.status_warning']()
        : m['settings.ai_support.status_blocked']();

  return (
    <Badge variant="outline" className={cn('border', toneStyles[status])}>
      {label}
    </Badge>
  );
}

function MetricCard({ metric }: { metric: Metric }) {
  const Icon = metric.icon;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{metric.value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{metric.description}</p>
      </CardContent>
    </Card>
  );
}

function LaunchChecklist({ items }: { items: LaunchItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{m['settings.ai_support.launch_title']()}</CardTitle>
        <CardDescription>{m['settings.ai_support.launch_description']()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, index) => (
          <div key={`${item.label}-${index}`} className="flex items-start gap-3 rounded-lg border border-border p-3">
            {item.status === 'ready' ? (
              <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" />
            ) : item.status === 'warning' ? (
              <AlertTriangle className="mt-0.5 size-4 text-amber-600" />
            ) : (
              <LockKeyhole className="mt-0.5 size-4 text-destructive" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{item.label}</p>
                <StatusBadge status={item.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function KnowledgePanel({ sources }: { sources: SourceItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{m['settings.ai_support.knowledge_title']()}</CardTitle>
        <CardDescription>{m['settings.ai_support.knowledge_description']()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sources.map((source) => (
          <div key={source.label} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <p className="font-medium">{source.label}</p>
              <p className="text-sm text-muted-foreground">{source.kind}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <p className="hidden text-sm text-muted-foreground md:block">{source.detail}</p>
              <StatusBadge status={source.status} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AgentPolicyPanel({ policies }: { policies: AgentPolicy[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{m['settings.ai_support.agent_title']()}</CardTitle>
        <CardDescription>{m['settings.ai_support.agent_description']()}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-4 font-medium">{m['settings.ai_support.agent_col_identity']()}</th>
              <th className="py-2 pr-4 font-medium">{m['settings.ai_support.agent_col_scope']()}</th>
              <th className="py-2 pr-4 font-medium">{m['settings.ai_support.agent_col_access']()}</th>
              <th className="py-2 font-medium">{m['settings.ai_support.agent_col_approval']()}</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((policy) => (
              <tr key={policy.label} className="border-b last:border-0">
                <td className="py-3 pr-4 font-medium">{policy.label}</td>
                <td className="py-3 pr-4 text-muted-foreground">{policy.scope}</td>
                <td className="py-3 pr-4 text-muted-foreground">{policy.access}</td>
                <td className="py-3 text-muted-foreground">{policy.approval}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function FeatureGrid({ features }: { features: FeatureCard[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {features.map((feature) => {
        const Icon = feature.icon;

        return (
          <Card key={feature.label}>
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </div>
                <StatusBadge status={feature.status} />
              </div>
              <div>
                <CardTitle className="text-base">{feature.label}</CardTitle>
                <CardDescription className="mt-1">{feature.description}</CardDescription>
              </div>
            </CardHeader>
          </Card>
        );
      })}
    </div>
  );
}

function getEmbedSnippet(chatbot: AiChatbot) {
  const baseUrl =
    typeof window === 'undefined' ? '' : window.location.origin;
  return `<script
  async
  src="${baseUrl}/ai-support-widget.js"
  data-ai-support-public-key="${chatbot.publicKey}"
  data-ai-support-api-base="${baseUrl}"
></script>`;
}

function CompactRows<T>({
  rows,
  empty,
  render,
}: {
  rows: T[];
  empty: string;
  render: (row: T) => ReactNode;
}) {
  if (rows.length === 0) {
    return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{empty}</p>;
  }

  return <div className="space-y-2">{rows.map(render)}</div>;
}

function ChatbotOperations({
  chatbots,
  pending,
  installCheckPending,
  onCreate,
  onActivate,
  onCheckInstallation,
}: {
  chatbots: AiChatbot[];
  pending: boolean;
  installCheckPending: boolean;
  onCreate: (input: { name: string; description: string; allowedDomains: string[] }) => Promise<void>;
  onActivate: (chatbot: AiChatbot) => Promise<void>;
  onCheckInstallation: (input: { chatbotId: string; url: string }) => Promise<InstallationCheckResult>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [domains, setDomains] = useState('');
  const [installUrls, setInstallUrls] = useState<Record<string, string>>({});
  const [installResults, setInstallResults] = useState<Record<string, InstallationCheckResult>>({});

  async function submit() {
    await onCreate({
      name,
      description,
      allowedDomains: domains
        .split(',')
        .map((domain) => domain.trim())
        .filter(Boolean),
    });
    setName('');
    setDescription('');
    setDomains('');
    setOpen(false);
  }

  async function checkInstall(chatbot: AiChatbot) {
    const url = installUrls[chatbot.id]?.trim();
    if (!url) return;
    const result = await onCheckInstallation({ chatbotId: chatbot.id, url });
    setInstallResults((current) => ({ ...current, [chatbot.id]: result }));
    toast[result.installed ? 'success' : 'warning'](result.reason);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{m['settings.ai_support.ops_chatbots_title']()}</CardTitle>
          <CardDescription>{m['settings.ai_support.ops_chatbots_desc']()}</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="size-4" />
            {m['settings.ai_support.ops_create_chatbot']()}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{m['settings.ai_support.ops_create_chatbot']()}</DialogTitle>
              <DialogDescription>{m['settings.ai_support.ops_create_chatbot_desc']()}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="ai-chatbot-name">{m['settings.ai_support.ops_name']()}</Label>
                <Input id="ai-chatbot-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ai-chatbot-description">{m['settings.ai_support.ops_description']()}</Label>
                <Textarea
                  id="ai-chatbot-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ai-chatbot-domains">{m['settings.ai_support.ops_domains']()}</Label>
                <Input
                  id="ai-chatbot-domains"
                  value={domains}
                  onChange={(e) => setDomains(e.target.value)}
                  placeholder="example.com, docs.example.com"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={pending || !name.trim()}>
                {m['settings.ai_support.ops_save']()}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <CompactRows
          rows={chatbots}
          empty={m['settings.ai_support.ops_no_chatbots']()}
          render={(chatbot) => (
            <div key={chatbot.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{chatbot.name}</p>
                    <Badge variant="outline">{chatbot.status}</Badge>
                    <Badge variant="outline">{chatbot.installStatus}</Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{chatbot.publicKey}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await navigator.clipboard.writeText(getEmbedSnippet(chatbot));
                      toast.success(m['settings.ai_support.ops_copied']());
                    }}
                  >
                    <Clipboard className="size-4" />
                    {m['settings.ai_support.ops_copy_embed']()}
                  </Button>
                  <Button
                    size="sm"
                    disabled={pending || chatbot.status === 'active'}
                    onClick={() => onActivate(chatbot)}
                  >
                    <Rocket className="size-4" />
                    {m['settings.ai_support.ops_activate']()}
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 rounded-lg bg-muted/35 p-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <Input
                  value={installUrls[chatbot.id] ?? ''}
                  onChange={(event) =>
                    setInstallUrls((current) => ({ ...current, [chatbot.id]: event.target.value }))
                  }
                  placeholder="https://example.com"
                  aria-label={m['settings.ai_support.ops_install_url']()}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={installCheckPending || !installUrls[chatbot.id]?.trim()}
                  onClick={() => checkInstall(chatbot)}
                >
                  <ShieldCheck className="size-4" />
                  {m['settings.ai_support.ops_check_install']()}
                </Button>
                {installResults[chatbot.id] ? (
                  <div className="text-sm text-muted-foreground md:col-span-2">
                    <span className={installResults[chatbot.id].installed ? 'text-emerald-600' : 'text-amber-600'}>
                      {installResults[chatbot.id].installed
                        ? m['settings.ai_support.ops_install_detected']()
                        : m['settings.ai_support.ops_install_missing']()}
                    </span>
                    {' · '}
                    {installResults[chatbot.id].statusCode ?? 'n/a'}
                    {' · '}
                    {installResults[chatbot.id].reason}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground md:col-span-2">
                    {m['settings.ai_support.ops_install_help']()}
                  </p>
                )}
              </div>
            </div>
          )}
        />
      </CardContent>
    </Card>
  );
}

function KnowledgeOperations({
  chatbots,
  sources,
  pending,
  onCreate,
}: {
  chatbots: AiChatbot[];
  sources: AiKnowledgeSource[];
  pending: boolean;
  onCreate: (input: {
    chatbotId: string;
    type: OverviewSourceType;
    title: string;
    content?: string;
    sourceUrl?: string;
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [chatbotId, setChatbotId] = useState('');
  const [type, setType] = useState<OverviewSourceType>('text_snippet');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  async function submit() {
    await onCreate({
      chatbotId: chatbotId || chatbots[0]?.id || '',
      type,
      title,
      content,
      sourceUrl,
    });
    setTitle('');
    setContent('');
    setSourceUrl('');
    setOpen(false);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{m['settings.ai_support.ops_knowledge_title']()}</CardTitle>
          <CardDescription>{m['settings.ai_support.ops_knowledge_desc']()}</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" variant="outline" disabled={chatbots.length === 0} />}>
            <Plus className="size-4" />
            {m['settings.ai_support.ops_add_source']()}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{m['settings.ai_support.ops_add_source']()}</DialogTitle>
              <DialogDescription>{m['settings.ai_support.ops_add_source_desc']()}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ai-source-chatbot">{m['settings.ai_support.ops_chatbot']()}</Label>
                <select
                  id="ai-source-chatbot"
                  className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                  value={chatbotId || chatbots[0]?.id || ''}
                  onChange={(e) => setChatbotId(e.target.value)}
                >
                  {chatbots.map((chatbot) => (
                    <option key={chatbot.id} value={chatbot.id}>{chatbot.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ai-source-type">{m['settings.ai_support.ops_type']()}</Label>
                <select
                  id="ai-source-type"
                  className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                  value={type}
                  onChange={(e) => setType(e.target.value as OverviewSourceType)}
                >
                  <option value="custom_response">Custom response</option>
                  <option value="text_snippet">Text snippet</option>
                  <option value="website_link">Website link</option>
                  <option value="file">File reference</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ai-source-title">{m['settings.ai_support.ops_title']()}</Label>
                <Input id="ai-source-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ai-source-url">{m['settings.ai_support.ops_source_url']()}</Label>
                <Input id="ai-source-url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ai-source-content">{m['settings.ai_support.ops_content']()}</Label>
                <Textarea id="ai-source-content" value={content} onChange={(e) => setContent(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={pending || !title.trim()}>
                {m['settings.ai_support.ops_save']()}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <CompactRows
          rows={sources.slice(0, 5)}
          empty={m['settings.ai_support.ops_no_sources']()}
          render={(source) => (
            <div key={source.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{source.title}</p>
                <p className="text-sm text-muted-foreground">{source.type}</p>
              </div>
              <Badge variant="outline">{source.status}</Badge>
            </div>
          )}
        />
      </CardContent>
    </Card>
  );
}

function AgentTokenOperations({
  chatbots,
  tokens,
  pending,
  revokePending,
  onCreate,
  onRevoke,
}: {
  chatbots: AiChatbot[];
  tokens: AiAgentToken[];
  pending: boolean;
  revokePending: boolean;
  onCreate: (input: { name: string; chatbotIds: string[]; expiresAt: string | null }) => Promise<void>;
  onRevoke: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('Codex Ops');
  const [chatbotId, setChatbotId] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('30');

  async function submit() {
    const days = Number(expiresInDays);
    const expiresAt = days > 0
      ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      : null;
    await onCreate({
      name,
      chatbotIds: (chatbotId || chatbots[0]?.id) ? [chatbotId || chatbots[0].id] : [],
      expiresAt,
    });
    setOpen(false);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{m['settings.ai_support.ops_tokens_title']()}</CardTitle>
          <CardDescription>{m['settings.ai_support.ops_tokens_desc']()}</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" variant="outline" />}>
            <KeyRound className="size-4" />
            {m['settings.ai_support.ops_create_token']()}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{m['settings.ai_support.ops_create_token']()}</DialogTitle>
              <DialogDescription>{m['settings.ai_support.ops_create_token_desc']()}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ai-token-name">{m['settings.ai_support.ops_name']()}</Label>
                <Input id="ai-token-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ai-token-chatbot">{m['settings.ai_support.ops_chatbot']()}</Label>
                <select
                  id="ai-token-chatbot"
                  className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                  value={chatbotId || chatbots[0]?.id || ''}
                  onChange={(e) => setChatbotId(e.target.value)}
                >
                  {chatbots.map((chatbot) => (
                    <option key={chatbot.id} value={chatbot.id}>{chatbot.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ai-token-expiry">{m['settings.ai_support.ops_token_expiry']()}</Label>
                <select
                  id="ai-token-expiry"
                  className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                >
                  <option value="7">{m['settings.ai_support.ops_token_expiry_7d']()}</option>
                  <option value="30">{m['settings.ai_support.ops_token_expiry_30d']()}</option>
                  <option value="90">{m['settings.ai_support.ops_token_expiry_90d']()}</option>
                  <option value="0">{m['settings.ai_support.ops_token_expiry_never']()}</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={pending || !name.trim()}>
                {m['settings.ai_support.ops_save']()}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <CompactRows
          rows={tokens.slice(0, 5)}
          empty={m['settings.ai_support.ops_no_tokens']()}
          render={(token) => {
            const expiresLabel = token.expiresAt
              ? new Date(token.expiresAt).toLocaleDateString()
              : m['settings.ai_support.ops_token_expiry_never']();
            const lastUsedLabel = token.lastUsedAt
              ? new Date(token.lastUsedAt).toLocaleString()
              : m['settings.ai_support.ops_token_never_used']();

            return (
              <div key={token.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{token.name}</p>
                  <p className="text-sm text-muted-foreground">{token.tokenPrefix}... · {token.accessProfile}</p>
                  <p className="text-xs text-muted-foreground">
                    {m['settings.ai_support.ops_token_expires']()}: {expiresLabel} ·{' '}
                    {m['settings.ai_support.ops_token_last_used']()}: {lastUsedLabel}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={token.status === 'active' ? 'default' : 'outline'}>{token.status}</Badge>
                  <Badge variant="outline">{token.scopes.length} scopes</Badge>
                  {token.status === 'active' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={revokePending}
                      onClick={() => onRevoke(token.id)}
                    >
                      <LockKeyhole className="size-4" />
                      {m['settings.ai_support.ops_revoke_token']()}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          }}
        />
      </CardContent>
    </Card>
  );
}

function parseAgentDiff(raw: string | null): { settingKey?: string; content?: string } {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? {
          settingKey: typeof parsed.settingKey === 'string' ? parsed.settingKey : undefined,
          content: typeof parsed.content === 'string' ? parsed.content : undefined,
        }
      : {};
  } catch {
    return {};
  }
}

function AgentApprovalOperations({
  chatbots,
  runs,
  pending,
  onCreate,
  onReview,
}: {
  chatbots: AiChatbot[];
  runs: AiAgentRun[];
  pending: boolean;
  onCreate: (input: {
    chatbotId: string;
    action: string;
    summary: string;
    settingKey: string;
    content: string;
  }) => Promise<void>;
  onReview: (input: { id: string; decision: 'approve' | 'reject' }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [chatbotId, setChatbotId] = useState('');
  const [settingKey, setSettingKey] = useState('chatbot.instructions');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');

  async function submit() {
    await onCreate({
      chatbotId: chatbotId || chatbots[0]?.id || '',
      action: 'config.propose',
      summary,
      settingKey,
      content,
    });
    setSummary('');
    setContent('');
    setOpen(false);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{m['settings.ai_support.ops_agent_runs_title']()}</CardTitle>
          <CardDescription>{m['settings.ai_support.ops_agent_runs_desc']()}</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" variant="outline" disabled={chatbots.length === 0} />}>
            <Sparkles className="size-4" />
            {m['settings.ai_support.ops_create_agent_run']()}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{m['settings.ai_support.ops_create_agent_run']()}</DialogTitle>
              <DialogDescription>{m['settings.ai_support.ops_create_agent_run_desc']()}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ai-run-chatbot">{m['settings.ai_support.ops_chatbot']()}</Label>
                <select
                  id="ai-run-chatbot"
                  className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                  value={chatbotId || chatbots[0]?.id || ''}
                  onChange={(e) => setChatbotId(e.target.value)}
                >
                  {chatbots.map((chatbot) => (
                    <option key={chatbot.id} value={chatbot.id}>{chatbot.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ai-run-setting">{m['settings.ai_support.ops_setting_key']()}</Label>
                <Input id="ai-run-setting" value={settingKey} onChange={(e) => setSettingKey(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ai-run-summary">{m['settings.ai_support.ops_summary']()}</Label>
                <Input id="ai-run-summary" value={summary} onChange={(e) => setSummary(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ai-run-content">{m['settings.ai_support.ops_content']()}</Label>
                <Textarea id="ai-run-content" value={content} onChange={(e) => setContent(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={pending || !summary.trim() || !settingKey.trim() || !content.trim()}>
                {m['settings.ai_support.ops_save']()}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <CompactRows
          rows={runs.slice(0, 8)}
          empty={m['settings.ai_support.ops_no_agent_runs']()}
          render={(run) => {
            const diff = parseAgentDiff(run.diff);
            return (
              <div key={run.id} className="flex flex-col gap-3 rounded-lg border border-border p-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{run.summary || run.action}</p>
                      <Badge variant="outline">{run.status}</Badge>
                      {run.approvalRequired ? (
                        <Badge variant="secondary">{m['settings.ai_support.ops_requires_approval']()}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {diff.settingKey || run.action} · {new Date(run.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {run.status === 'pending_approval' ? (
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" disabled={pending} onClick={() => onReview({ id: run.id, decision: 'approve' })}>
                        <CheckCircle2 className="size-4" />
                        {m['settings.ai_support.ops_approve']()}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => onReview({ id: run.id, decision: 'reject' })}
                      >
                        <AlertTriangle className="size-4" />
                        {m['settings.ai_support.ops_reject']()}
                      </Button>
                    </div>
                  ) : null}
                </div>
                {diff.content ? (
                  <p className="line-clamp-3 rounded-md bg-muted/50 p-2 text-sm text-muted-foreground">
                    {diff.content}
                  </p>
                ) : null}
              </div>
            );
          }}
        />
      </CardContent>
    </Card>
  );
}

function ConfigVersionOperations({
  versions,
  pending,
  onRollback,
}: {
  versions: AiConfigVersion[];
  pending: boolean;
  onRollback: (id: string) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{m['settings.ai_support.ops_versions_title']()}</CardTitle>
        <CardDescription>{m['settings.ai_support.ops_versions_desc']()}</CardDescription>
      </CardHeader>
      <CardContent>
        <CompactRows
          rows={versions.slice(0, 8)}
          empty={m['settings.ai_support.ops_no_versions']()}
          render={(version) => (
            <div key={version.id} className="flex flex-col gap-3 rounded-lg border border-border p-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">
                    {version.settingKey} v{version.version}
                  </p>
                  <Badge variant="outline">{version.status}</Badge>
                  <Badge variant="secondary">{version.createdByType}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{version.content}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(version.createdAt).toLocaleString()}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={pending || version.status === 'published'}
                onClick={() => onRollback(version.id)}
              >
                <RotateCcw className="size-4" />
                {m['settings.ai_support.ops_rollback']()}
              </Button>
            </div>
          )}
        />
      </CardContent>
    </Card>
  );
}

function SupportQueueOperations({
  leads,
  escalations,
  retryPending,
  onRetryNotifications,
}: {
  leads: AiLead[];
  escalations: AiEscalation[];
  retryPending: boolean;
  onRetryNotifications: (id: string) => Promise<void>;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{m['settings.ai_support.ops_leads_title']()}</CardTitle>
          <CardDescription>{m['settings.ai_support.ops_leads_desc']()}</CardDescription>
        </CardHeader>
        <CardContent>
          <CompactRows
            rows={leads.slice(0, 5)}
            empty={m['settings.ai_support.ops_no_leads']()}
            render={(lead) => (
              <div key={lead.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{lead.name || lead.email || lead.phone || lead.id}</p>
                  <p className="text-sm text-muted-foreground">{lead.email || lead.phone || 'No contact detail'}</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">{lead.priority}</Badge>
                  <Badge variant="outline">{lead.status}</Badge>
                </div>
              </div>
            )}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{m['settings.ai_support.ops_escalations_title']()}</CardTitle>
          <CardDescription>{m['settings.ai_support.ops_escalations_desc']()}</CardDescription>
        </CardHeader>
        <CardContent>
          <CompactRows
            rows={escalations.slice(0, 5)}
            empty={m['settings.ai_support.ops_no_escalations']()}
            render={(item) => {
              const metadata = parseObjectMetadata(item.metadata);
              const deliveries = parseNotificationDeliveries(metadata);
              const hasFailedDelivery = deliveries.some((delivery) => delivery.status === 'failed');

              return (
                <div key={item.id} className="flex flex-col gap-3 rounded-lg border border-border p-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.summary || item.id}</p>
                    <p className="text-sm text-muted-foreground">{item.assigneeUserId || 'Unassigned'}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {deliveries.map((delivery) => (
                      <Badge
                        key={`${delivery.channel}-${delivery.status}`}
                        variant={delivery.status === 'sent' ? 'secondary' : 'outline'}
                      >
                        {delivery.channel === 'email'
                          ? delivery.status === 'sent'
                            ? m['settings.ai_support.ops_notification_email_sent']()
                            : m['settings.ai_support.ops_notification_email_failed']()
                          : delivery.status === 'sent'
                            ? m['settings.ai_support.ops_notification_webhook_sent']()
                            : m['settings.ai_support.ops_notification_webhook_failed']()}
                      </Badge>
                    ))}
                    <Badge variant="outline">{item.status}</Badge>
                    {hasFailedDelivery ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={retryPending}
                        onClick={() => onRetryNotifications(item.id)}
                      >
                        <RotateCcw className="size-4" />
                        {m['settings.ai_support.ops_retry_notifications']()}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function parseNotificationDeliveries(metadata: Record<string, unknown>): Array<{
  channel: 'email' | 'webhook';
  status: 'sent' | 'failed';
}> {
  const rawDeliveries = Array.isArray(metadata.notificationDeliveries)
    ? metadata.notificationDeliveries
    : metadata.notificationDelivery
      ? [metadata.notificationDelivery]
      : [];

  return rawDeliveries.flatMap((item) => {
    const delivery = parseObjectMetadata(item);
    const channel = delivery.channel === 'email' || delivery.channel === 'webhook'
      ? delivery.channel
      : null;
    const status = delivery.status === 'sent' || delivery.status === 'failed'
      ? delivery.status
      : null;
    return channel && status ? [{ channel, status }] : [];
  });
}

function parseObjectMetadata(input: unknown): Record<string, unknown> {
  if (!input) return {};
  if (typeof input === 'object' && !Array.isArray(input)) return input as Record<string, unknown>;
  if (typeof input !== 'string') return {};
  try {
    const parsed = JSON.parse(input);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function HumanSupportSettingsPanel({
  chatbotId,
  settings,
  pending,
  onSave,
}: {
  chatbotId: string;
  settings: HumanSupportSettings | undefined;
  pending: boolean;
  onSave: (input: HumanSupportSettings) => Promise<void>;
}) {
  const [draft, setDraft] = useState<HumanSupportSettings | null>(null);
  const value = draft ?? settings;

  function update<K extends keyof HumanSupportSettings>(key: K, next: HumanSupportSettings[K]) {
    setDraft({
      ...(value ?? {
        enabled: true,
        showEscalationButtons: true,
        replaceSuggestions: false,
        positivePrompt: 'That answered my question 👍',
        requestPrompt: 'Connect to an agent 👤',
        confirmationMessage:
          'Your request has been forwarded to our human support team. They will respond soon.',
        notificationsEnabled: false,
        notificationEmail: '',
        notificationWebhookUrl: '',
      }),
      [key]: next,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m['settings.ai_support.ops_human_settings_title']()}</CardTitle>
        <CardDescription>{m['settings.ai_support.ops_human_settings_desc']()}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {!chatbotId || !value ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {m['settings.ai_support.ops_human_settings_empty']()}
          </p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={value.enabled}
                  onChange={(event) => update('enabled', event.target.checked)}
                />
                {m['settings.ai_support.ops_human_enabled']()}
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={value.showEscalationButtons}
                  onChange={(event) => update('showEscalationButtons', event.target.checked)}
                />
                {m['settings.ai_support.ops_human_buttons']()}
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={value.notificationsEnabled}
                  onChange={(event) => update('notificationsEnabled', event.target.checked)}
                />
                {m['settings.ai_support.ops_human_notifications']()}
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="ai-human-positive">{m['settings.ai_support.ops_positive_prompt']()}</Label>
                <Input
                  id="ai-human-positive"
                  value={value.positivePrompt}
                  onChange={(event) => update('positivePrompt', event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ai-human-request">{m['settings.ai_support.ops_request_prompt']()}</Label>
                <Input
                  id="ai-human-request"
                  value={value.requestPrompt}
                  onChange={(event) => update('requestPrompt', event.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ai-human-confirmation">{m['settings.ai_support.ops_confirmation_message']()}</Label>
              <Textarea
                id="ai-human-confirmation"
                value={value.confirmationMessage}
                onChange={(event) => update('confirmationMessage', event.target.value)}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="ai-human-email">{m['settings.ai_support.ops_notification_email']()}</Label>
                <Input
                  id="ai-human-email"
                  value={value.notificationEmail}
                  onChange={(event) => update('notificationEmail', event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ai-human-webhook">{m['settings.ai_support.ops_notification_webhook']()}</Label>
                <Input
                  id="ai-human-webhook"
                  value={value.notificationWebhookUrl}
                  onChange={(event) => update('notificationWebhookUrl', event.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                disabled={pending || !draft}
                onClick={() => onSave(value).then(() => setDraft(null))}
              >
                {m['settings.ai_support.ops_save']()}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function WidgetAppearancePanel({
  chatbotId,
  settings,
  pending,
  onSave,
}: {
  chatbotId: string;
  settings: WidgetAppearanceSettings | undefined;
  pending: boolean;
  onSave: (input: WidgetAppearanceSettings) => Promise<void>;
}) {
  const [draft, setDraft] = useState<WidgetAppearanceSettings | null>(null);
  const value = draft ?? settings;

  function update<K extends keyof WidgetAppearanceSettings>(key: K, next: WidgetAppearanceSettings[K]) {
    setDraft({
      ...(value ?? {
        displayName: 'AI Support',
        welcomeMessage: 'Leave your contact details and we will help from here.',
        placeholder: 'How can we help?',
        launcherLabel: '?',
        primaryColor: '#2563eb',
      }),
      [key]: next,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m['settings.ai_support.ops_appearance_title']()}</CardTitle>
        <CardDescription>{m['settings.ai_support.ops_appearance_desc']()}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {!chatbotId || !value ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {m['settings.ai_support.ops_human_settings_empty']()}
          </p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="ai-widget-name">{m['settings.ai_support.ops_appearance_name']()}</Label>
                <Input
                  id="ai-widget-name"
                  value={value.displayName}
                  onChange={(event) => update('displayName', event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ai-widget-color">{m['settings.ai_support.ops_appearance_color']()}</Label>
                <Input
                  id="ai-widget-color"
                  type="color"
                  value={value.primaryColor}
                  onChange={(event) => update('primaryColor', event.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ai-widget-welcome">{m['settings.ai_support.ops_appearance_welcome']()}</Label>
              <Textarea
                id="ai-widget-welcome"
                value={value.welcomeMessage}
                onChange={(event) => update('welcomeMessage', event.target.value)}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="ai-widget-placeholder">{m['settings.ai_support.ops_appearance_placeholder']()}</Label>
                <Input
                  id="ai-widget-placeholder"
                  value={value.placeholder}
                  onChange={(event) => update('placeholder', event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ai-widget-launcher">{m['settings.ai_support.ops_appearance_launcher']()}</Label>
                <Input
                  id="ai-widget-launcher"
                  value={value.launcherLabel}
                  onChange={(event) => update('launcherLabel', event.target.value)}
                />
              </div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">{value.displayName}</p>
              <p className="mt-1 text-sm text-muted-foreground">{value.welcomeMessage}</p>
              <Button
                className="mt-3"
                style={{ backgroundColor: value.primaryColor }}
                size="sm"
              >
                {value.launcherLabel}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button
                disabled={pending || !draft}
                onClick={() => onSave(value).then(() => setDraft(null))}
              >
                {m['settings.ai_support.ops_save']()}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function LaunchOperationsPanel({
  chatbotId,
  settings,
  pending,
  onSave,
}: {
  chatbotId: string;
  settings: LaunchOperationsSettings | undefined;
  pending: boolean;
  onSave: (input: LaunchOperationsSettings) => Promise<void>;
}) {
  const [draft, setDraft] = useState<LaunchOperationsSettings | null>(null);
  const value = draft ?? settings;

  function update<K extends keyof LaunchOperationsSettings>(
    key: K,
    next: LaunchOperationsSettings[K]
  ) {
    setDraft({
      ...(value ?? {
        backupConfigured: false,
        backupRunbookUrl: '',
        errorAlertsEnabled: false,
        errorAlertWebhookUrl: '',
        logRetentionDays: 14,
        rateLimitEnabled: true,
        domainWhitelistRequired: true,
      }),
      [key]: next,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m['settings.ai_support.ops_launch_ops_title']()}</CardTitle>
        <CardDescription>{m['settings.ai_support.ops_launch_ops_desc']()}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {!chatbotId || !value ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {m['settings.ai_support.ops_human_settings_empty']()}
          </p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={value.backupConfigured}
                  onChange={(event) => update('backupConfigured', event.target.checked)}
                />
                {m['settings.ai_support.ops_backup_configured']()}
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={value.errorAlertsEnabled}
                  onChange={(event) => update('errorAlertsEnabled', event.target.checked)}
                />
                {m['settings.ai_support.ops_error_alerts_enabled']()}
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={value.rateLimitEnabled}
                  onChange={(event) => update('rateLimitEnabled', event.target.checked)}
                />
                {m['settings.ai_support.ops_rate_limit_enabled']()}
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="ai-launch-backup-runbook">
                  {m['settings.ai_support.ops_backup_runbook_url']()}
                </Label>
                <Input
                  id="ai-launch-backup-runbook"
                  value={value.backupRunbookUrl}
                  onChange={(event) => update('backupRunbookUrl', event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ai-launch-alert-webhook">
                  {m['settings.ai_support.ops_error_alert_webhook']()}
                </Label>
                <Input
                  id="ai-launch-alert-webhook"
                  value={value.errorAlertWebhookUrl}
                  onChange={(event) => update('errorAlertWebhookUrl', event.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="ai-launch-log-retention">
                  {m['settings.ai_support.ops_log_retention_days']()}
                </Label>
                <Input
                  id="ai-launch-log-retention"
                  type="number"
                  min={1}
                  max={365}
                  value={value.logRetentionDays}
                  onChange={(event) =>
                    update('logRetentionDays', Number.parseInt(event.target.value, 10) || 1)
                  }
                />
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={value.domainWhitelistRequired}
                  onChange={(event) => update('domainWhitelistRequired', event.target.checked)}
                />
                {m['settings.ai_support.ops_domain_whitelist_required']()}
              </label>
            </div>
            <div className="flex justify-end">
              <Button
                disabled={pending || !draft}
                onClick={() => onSave(value).then(() => setDraft(null))}
              >
                {m['settings.ai_support.ops_save']()}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function parseCitations(raw: string): Array<{ title?: string; sourceUrl?: string; id?: string }> {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ChatHistoryOperations({
  conversations,
  selected,
  selectedId,
  onSelect,
}: {
  conversations: AiConversation[];
  selected: AiConversationWithMessages | undefined;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <Card>
        <CardHeader>
          <CardTitle>{m['settings.ai_support.ops_conversations_title']()}</CardTitle>
          <CardDescription>{m['settings.ai_support.ops_conversations_desc']()}</CardDescription>
        </CardHeader>
        <CardContent>
          <CompactRows
            rows={conversations.slice(0, 10)}
            empty={m['settings.ai_support.ops_no_conversations']()}
            render={(conversation) => (
              <button
                key={conversation.id}
                type="button"
                className={cn(
                  'w-full rounded-lg border border-border p-3 text-left transition hover:bg-muted/50',
                  selectedId === conversation.id && 'border-primary bg-primary/5'
                )}
                onClick={() => onSelect(conversation.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-medium">
                    {conversation.contactName || conversation.contactEmail || conversation.visitorId || conversation.id}
                  </p>
                  <Badge variant="outline">{conversation.status}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {conversation.lastMessage || m['settings.ai_support.ops_no_last_message']()}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{conversation.messageCount} messages</span>
                  {conversation.sourceUrl ? <span className="truncate">{conversation.sourceUrl}</span> : null}
                </div>
              </button>
            )}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{m['settings.ai_support.ops_transcript_title']()}</CardTitle>
          <CardDescription>{m['settings.ai_support.ops_transcript_desc']()}</CardDescription>
        </CardHeader>
        <CardContent>
          {!selected ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              {m['settings.ai_support.ops_select_conversation']()}
            </p>
          ) : (
            <div className="space-y-3">
              {selected.messages.map((message) => {
                const citations = parseCitations(message.citations);
                return (
                  <div
                    key={message.id}
                    className={cn(
                      'rounded-lg border p-3',
                      message.role === 'user' ? 'bg-primary/5' : 'bg-muted/40'
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <Badge variant="outline">{message.role}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(message.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                    {citations.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {citations.map((citation) => (
                          <Badge key={citation.id || citation.title} variant="secondary">
                            {citation.title || citation.sourceUrl || citation.id}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AuditLogOperations({ logs }: { logs: AiAuditLog[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{m['settings.ai_support.ops_audit_title']()}</CardTitle>
        <CardDescription>{m['settings.ai_support.ops_audit_desc']()}</CardDescription>
      </CardHeader>
      <CardContent>
        <CompactRows
          rows={logs.slice(0, 8)}
          empty={m['settings.ai_support.ops_no_audit_logs']()}
          render={(log) => (
            <div key={log.id} className="flex flex-col gap-3 rounded-lg border border-border p-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{log.action}</p>
                  <Badge variant="outline">{log.actorType}</Badge>
                  {log.requiresApproval ? (
                    <Badge variant="secondary">{m['settings.ai_support.ops_requires_approval']()}</Badge>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {log.resourceType} · {log.resourceId}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{log.status}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        />
      </CardContent>
    </Card>
  );
}

function UsageOperations({ usage }: { usage: AiSupportUsage | undefined }) {
  const totals = usage?.totals;
  const summary = [
    {
      label: m['settings.ai_support.usage_chatbots'](),
      value: totals?.chatbots ?? 0,
      detail: m['settings.ai_support.usage_installed']({ count: totals?.installedChatbots ?? 0 }),
    },
    {
      label: m['settings.ai_support.usage_messages'](),
      value: totals?.messages ?? 0,
      detail: m['settings.ai_support.usage_conversations']({ count: totals?.conversations ?? 0 }),
    },
    {
      label: m['settings.ai_support.usage_leads'](),
      value: totals?.leads ?? 0,
      detail: m['settings.ai_support.usage_escalations']({ count: totals?.openEscalations ?? 0 }),
    },
    {
      label: m['settings.ai_support.usage_agent_controls'](),
      value: totals?.activeAgentTokens ?? 0,
      detail: m['settings.ai_support.usage_pending_approvals']({ count: totals?.pendingApprovals ?? 0 }),
    },
  ];

  function exportCsv() {
    if (typeof window === 'undefined') return;
    window.location.href = '/api/ai-support/usage?format=csv';
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{m['settings.ai_support.usage_title']()}</CardTitle>
          <CardDescription>{m['settings.ai_support.usage_desc']()}</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="size-4" />
          {m['settings.ai_support.usage_export_csv']()}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {summary.map((item) => (
            <div key={item.label} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{item.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span>
            {m['settings.ai_support.usage_generated_at']()}:{' '}
            {usage?.generatedAt ? new Date(usage.generatedAt).toLocaleString() : '-'}
          </span>
          <span>
            {m['settings.ai_support.usage_reset_at']()}:{' '}
            {usage?.resetAt ? new Date(usage.resetAt).toLocaleDateString() : '-'}
          </span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">{m['settings.ai_support.usage_col_chatbot']()}</th>
                <th className="px-3 py-2 font-medium">{m['settings.ai_support.usage_col_status']()}</th>
                <th className="px-3 py-2 font-medium">{m['settings.ai_support.usage_col_knowledge']()}</th>
                <th className="px-3 py-2 font-medium">{m['settings.ai_support.usage_col_conversations']()}</th>
                <th className="px-3 py-2 font-medium">{m['settings.ai_support.usage_col_messages']()}</th>
                <th className="px-3 py-2 font-medium">{m['settings.ai_support.usage_col_leads']()}</th>
                <th className="px-3 py-2 font-medium">{m['settings.ai_support.usage_col_escalations']()}</th>
              </tr>
            </thead>
            <tbody>
              {usage?.byChatbot.length ? (
                usage.byChatbot.map((row) => (
                  <tr key={row.chatbotId} className="border-b last:border-0">
                    <td className="px-3 py-3 font-medium">{row.name}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {row.status} · {row.installStatus}
                    </td>
                    <td className="px-3 py-3 tabular-nums">{row.knowledgeSources}</td>
                    <td className="px-3 py-3 tabular-nums">{row.conversations}</td>
                    <td className="px-3 py-3 tabular-nums">{row.messages}</td>
                    <td className="px-3 py-3 tabular-nums">{row.leads}</td>
                    <td className="px-3 py-3 tabular-nums">
                      {row.escalations}
                      {row.openEscalations > 0 ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {m['settings.ai_support.usage_open_escalations']({ count: row.openEscalations })}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                    {m['settings.ai_support.usage_empty']()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function AiSupportPage() {
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const overviewQuery = useQuery({
    queryKey: ['ai-support-overview'],
    queryFn: () => apiGet<AiSupportOverview>('/api/ai-support/overview'),
    retry: false,
  });
  const chatbotsQuery = useQuery({
    queryKey: ['ai-support-chatbots'],
    queryFn: () => apiGet<AiChatbot[]>('/api/ai-support/chatbots'),
    retry: false,
  });
  const primaryChatbotId = chatbotsQuery.data?.[0]?.id ?? '';
  const knowledgeQuery = useQuery({
    queryKey: ['ai-support-knowledge-sources'],
    queryFn: () => apiGet<AiKnowledgeSource[]>('/api/ai-support/knowledge-sources'),
    retry: false,
  });
  const leadsQuery = useQuery({
    queryKey: ['ai-support-leads'],
    queryFn: () => apiGet<AiLead[]>('/api/ai-support/leads'),
    retry: false,
  });
  const escalationsQuery = useQuery({
    queryKey: ['ai-support-escalations'],
    queryFn: () => apiGet<AiEscalation[]>('/api/ai-support/escalations'),
    retry: false,
  });
  const humanSupportSettingsQuery = useQuery({
    queryKey: ['ai-support-human-support-settings', primaryChatbotId],
    queryFn: () =>
      apiGet<HumanSupportSettings>(
        `/api/ai-support/human-support-settings?chatbotId=${encodeURIComponent(primaryChatbotId)}`
      ),
    enabled: Boolean(primaryChatbotId),
    retry: false,
  });
  const widgetAppearanceQuery = useQuery({
    queryKey: ['ai-support-widget-appearance', primaryChatbotId],
    queryFn: () =>
      apiGet<WidgetAppearanceSettings>(
        `/api/ai-support/widget-appearance?chatbotId=${encodeURIComponent(primaryChatbotId)}`
      ),
    enabled: Boolean(primaryChatbotId),
    retry: false,
  });
  const launchOperationsQuery = useQuery({
    queryKey: ['ai-support-launch-operations', primaryChatbotId],
    queryFn: () =>
      apiGet<LaunchOperationsSettings>(
        `/api/ai-support/launch-operations?chatbotId=${encodeURIComponent(primaryChatbotId)}`
      ),
    enabled: Boolean(primaryChatbotId),
    retry: false,
  });
  const tokensQuery = useQuery({
    queryKey: ['ai-support-agent-tokens'],
    queryFn: () => apiGet<AiAgentToken[]>('/api/ai-support/agent-tokens'),
    retry: false,
  });
  const agentRunsQuery = useQuery({
    queryKey: ['ai-support-agent-runs'],
    queryFn: () => apiGet<AiAgentRun[]>('/api/ai-support/agent-runs?limit=20'),
    retry: false,
  });
  const configVersionsQuery = useQuery({
    queryKey: ['ai-support-config-versions'],
    queryFn: () => apiGet<AiConfigVersion[]>('/api/ai-support/config-versions?limit=20'),
    retry: false,
  });
  const auditLogsQuery = useQuery({
    queryKey: ['ai-support-audit-logs'],
    queryFn: () => apiGet<AiAuditLog[]>('/api/ai-support/audit-logs?limit=20'),
    retry: false,
  });
  const usageQuery = useQuery({
    queryKey: ['ai-support-usage'],
    queryFn: () => apiGet<AiSupportUsage>('/api/ai-support/usage'),
    retry: false,
  });
  const conversationsQuery = useQuery({
    queryKey: ['ai-support-conversations'],
    queryFn: () => apiGet<AiConversation[]>('/api/ai-support/conversations'),
    retry: false,
  });
  const selectedConversationQuery = useQuery({
    queryKey: ['ai-support-conversation-messages', selectedConversationId],
    queryFn: () =>
      apiGet<AiConversationWithMessages>(
        `/api/ai-support/conversation-messages?conversationId=${encodeURIComponent(selectedConversationId)}`
      ),
    enabled: Boolean(selectedConversationId),
    retry: false,
  });

  async function refreshAiSupport() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['ai-support-overview'] }),
      queryClient.invalidateQueries({ queryKey: ['ai-support-chatbots'] }),
      queryClient.invalidateQueries({ queryKey: ['ai-support-knowledge-sources'] }),
      queryClient.invalidateQueries({ queryKey: ['ai-support-agent-tokens'] }),
      queryClient.invalidateQueries({ queryKey: ['ai-support-agent-runs'] }),
      queryClient.invalidateQueries({ queryKey: ['ai-support-config-versions'] }),
      queryClient.invalidateQueries({ queryKey: ['ai-support-human-support-settings'] }),
      queryClient.invalidateQueries({ queryKey: ['ai-support-widget-appearance'] }),
      queryClient.invalidateQueries({ queryKey: ['ai-support-launch-operations'] }),
      queryClient.invalidateQueries({ queryKey: ['ai-support-audit-logs'] }),
      queryClient.invalidateQueries({ queryKey: ['ai-support-conversations'] }),
      queryClient.invalidateQueries({ queryKey: ['ai-support-usage'] }),
    ]);
  }

  const createChatbotMutation = useMutation({
    mutationFn: (input: { name: string; description: string; allowedDomains: string[] }) =>
      apiPost<AiChatbot>('/api/ai-support/chatbots', input),
    onSuccess: async () => {
      toast.success(m['settings.ai_support.ops_saved']());
      await refreshAiSupport();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const activateChatbotMutation = useMutation({
    mutationFn: (chatbot: AiChatbot) =>
      apiPatch<AiChatbot>('/api/ai-support/chatbots', {
        id: chatbot.id,
        status: 'active',
        installStatus: 'installed',
      }),
    onSuccess: async () => {
      toast.success(m['settings.ai_support.ops_saved']());
      await refreshAiSupport();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const checkInstallationMutation = useMutation({
    mutationFn: (input: { chatbotId: string; url: string }) =>
      apiPost<InstallationCheckResult>('/api/ai-support/install-check', input),
    onSuccess: async () => {
      await refreshAiSupport();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const createKnowledgeMutation = useMutation({
    mutationFn: (input: {
      chatbotId: string;
      type: OverviewSourceType;
      title: string;
      content?: string;
      sourceUrl?: string;
    }) => apiPost<AiKnowledgeSource>('/api/ai-support/knowledge-sources', input),
    onSuccess: async () => {
      toast.success(m['settings.ai_support.ops_saved']());
      await refreshAiSupport();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const createTokenMutation = useMutation({
    mutationFn: (input: { name: string; chatbotIds: string[]; expiresAt: string | null }) =>
      apiPost<{ token: string; record: AiAgentToken }>('/api/ai-support/agent-tokens', input),
    onSuccess: async (result) => {
      await navigator.clipboard.writeText(result.token);
      toast.success(m['settings.ai_support.ops_token_copied']());
      await refreshAiSupport();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const revokeTokenMutation = useMutation({
    mutationFn: (id: string) =>
      apiPatch<AiAgentToken>('/api/ai-support/agent-tokens', {
        id,
        action: 'revoke',
      }),
    onSuccess: async () => {
      toast.success(m['settings.ai_support.ops_token_revoked']());
      await refreshAiSupport();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const createAgentRunMutation = useMutation({
    mutationFn: (input: {
      chatbotId: string;
      action: string;
      summary: string;
      settingKey: string;
      content: string;
    }) => apiPost<AiAgentRun>('/api/ai-support/agent-runs', input),
    onSuccess: async () => {
      toast.success(m['settings.ai_support.ops_saved']());
      await refreshAiSupport();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const reviewAgentRunMutation = useMutation({
    mutationFn: (input: { id: string; decision: 'approve' | 'reject' }) =>
      apiPatch<AiAgentRun>('/api/ai-support/agent-runs', input),
    onSuccess: async () => {
      toast.success(m['settings.ai_support.ops_saved']());
      await refreshAiSupport();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const rollbackConfigVersionMutation = useMutation({
    mutationFn: (id: string) => apiPost<AiConfigVersion>('/api/ai-support/config-versions', { id }),
    onSuccess: async () => {
      toast.success(m['settings.ai_support.ops_saved']());
      await refreshAiSupport();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const updateHumanSupportSettingsMutation = useMutation({
    mutationFn: (input: HumanSupportSettings) =>
      apiPatch<HumanSupportSettings>('/api/ai-support/human-support-settings', {
        chatbotId: primaryChatbotId,
        ...input,
      }),
    onSuccess: async () => {
      toast.success(m['settings.ai_support.ops_saved']());
      await refreshAiSupport();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const updateWidgetAppearanceMutation = useMutation({
    mutationFn: (input: WidgetAppearanceSettings) =>
      apiPatch<WidgetAppearanceSettings>('/api/ai-support/widget-appearance', {
        chatbotId: primaryChatbotId,
        ...input,
      }),
    onSuccess: async () => {
      toast.success(m['settings.ai_support.ops_saved']());
      await refreshAiSupport();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const updateLaunchOperationsMutation = useMutation({
    mutationFn: (input: LaunchOperationsSettings) =>
      apiPatch<LaunchOperationsSettings>('/api/ai-support/launch-operations', {
        chatbotId: primaryChatbotId,
        ...input,
      }),
    onSuccess: async () => {
      toast.success(m['settings.ai_support.ops_saved']());
      await refreshAiSupport();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const retryEscalationNotificationsMutation = useMutation({
    mutationFn: (id: string) =>
      apiPatch<AiEscalation>('/api/ai-support/escalations', {
        id,
        action: 'retryNotifications',
      }),
    onSuccess: async () => {
      toast.success(m['settings.ai_support.ops_notifications_retried']());
      await refreshAiSupport();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const overview = overviewQuery.data;
  const chatbots = chatbotsQuery.data ?? [];
  const knowledgeSources = knowledgeQuery.data ?? [];
  const leads = leadsQuery.data ?? [];
  const escalations = escalationsQuery.data ?? [];
  const humanSupportSettings = humanSupportSettingsQuery.data;
  const widgetAppearance = widgetAppearanceQuery.data;
  const launchOperations = launchOperationsQuery.data;
  const tokens = tokensQuery.data ?? [];
  const agentRuns = agentRunsQuery.data ?? [];
  const configVersions = configVersionsQuery.data ?? [];
  const auditLogs = auditLogsQuery.data ?? [];
  const usage = usageQuery.data;
  const conversations = conversationsQuery.data ?? [];
  const selectedConversation = selectedConversationQuery.data;

  const metrics: Metric[] = overview?.metrics.length
    ? overview.metrics.map((metric) => ({
        ...metricMeta[metric.key],
        value: String(metric.value),
      }))
    : [
        {
          label: m['settings.ai_support.metric_chatbots'](),
          value: '0',
          description: m['settings.ai_support.metric_chatbots_desc'](),
          icon: Bot,
        },
        {
          label: m['settings.ai_support.metric_knowledge'](),
          value: '0',
          description: m['settings.ai_support.metric_knowledge_desc'](),
          icon: DatabaseZap,
        },
        {
          label: m['settings.ai_support.metric_handoffs'](),
          value: '0',
          description: m['settings.ai_support.metric_handoffs_desc'](),
          icon: Headphones,
        },
        {
          label: m['settings.ai_support.metric_agent_actions'](),
          value: '0',
          description: m['settings.ai_support.metric_agent_actions_desc'](),
          icon: Sparkles,
        },
      ];

  const launchItems: LaunchItem[] = overview?.checklist.length
    ? overview.checklist.map((item) => ({
        ...launchMeta[item.key],
        status: item.status,
      }))
    : [
        {
          label: m['settings.ai_support.launch_install'](),
          description: m['settings.ai_support.launch_install_desc'](),
          status: 'warning',
        },
        {
          label: m['settings.ai_support.launch_knowledge'](),
          description: m['settings.ai_support.launch_knowledge_desc'](),
          status: 'warning',
        },
        {
          label: m['settings.ai_support.launch_human'](),
          description: m['settings.ai_support.launch_human_desc'](),
          status: 'warning',
        },
        {
          label: m['settings.ai_support.launch_agent'](),
          description: m['settings.ai_support.launch_agent_desc'](),
          status: 'warning',
        },
        {
          label: m['settings.ai_support.launch_security'](),
          description: m['settings.ai_support.launch_security_desc'](),
          status: 'blocked',
        },
      ];

  const sources: SourceItem[] = overview?.knowledgeSources.length
    ? overview.knowledgeSources.map((source) => ({
        ...sourceMeta[source.type],
        status: source.total > 0 && source.needsReview === 0 ? 'ready' : 'warning',
        detail:
          source.total > 0
            ? `${source.ready}/${source.total}`
            : sourceMeta[source.type].detail,
      }))
    : [
        {
          label: m['settings.ai_support.source_custom'](),
          kind: m['settings.ai_support.source_custom_kind'](),
          status: 'warning',
          detail: m['settings.ai_support.source_custom_detail'](),
        },
        {
          label: m['settings.ai_support.source_text'](),
          kind: m['settings.ai_support.source_text_kind'](),
          status: 'warning',
          detail: m['settings.ai_support.source_text_detail'](),
        },
        {
          label: m['settings.ai_support.source_links'](),
          kind: m['settings.ai_support.source_links_kind'](),
          status: 'warning',
          detail: m['settings.ai_support.source_links_detail'](),
        },
        {
          label: m['settings.ai_support.source_files'](),
          kind: m['settings.ai_support.source_files_kind'](),
          status: 'warning',
          detail: m['settings.ai_support.source_files_detail'](),
        },
      ];

  const policies: AgentPolicy[] = [
    {
      label: m['settings.ai_support.policy_codex'](),
      scope: m['settings.ai_support.policy_codex_scope'](),
      access: m['settings.ai_support.policy_codex_access'](),
      approval: m['settings.ai_support.policy_codex_approval'](),
    },
    {
      label: m['settings.ai_support.policy_support'](),
      scope: m['settings.ai_support.policy_support_scope'](),
      access: m['settings.ai_support.policy_support_access'](),
      approval: m['settings.ai_support.policy_support_approval'](),
    },
    {
      label: m['settings.ai_support.policy_billing'](),
      scope: m['settings.ai_support.policy_billing_scope'](),
      access: m['settings.ai_support.policy_billing_access'](),
      approval: m['settings.ai_support.policy_billing_approval'](),
    },
  ];

  const features: FeatureCard[] = [
    {
      label: m['settings.ai_support.feature_install'](),
      description: m['settings.ai_support.feature_install_desc'](),
      icon: Braces,
      status: 'ready',
    },
    {
      label: m['settings.ai_support.feature_chat'](),
      description: m['settings.ai_support.feature_chat_desc'](),
      icon: MessageSquare,
      status: 'ready',
    },
    {
      label: m['settings.ai_support.feature_leads'](),
      description: m['settings.ai_support.feature_leads_desc'](),
      icon: Users,
      status: 'warning',
    },
    {
      label: m['settings.ai_support.feature_human'](),
      description: m['settings.ai_support.feature_human_desc'](),
      icon: Headphones,
      status: 'warning',
    },
    {
      label: m['settings.ai_support.feature_appearance'](),
      description: m['settings.ai_support.feature_appearance_desc'](),
      icon: Palette,
      status: 'ready',
    },
    {
      label: m['settings.ai_support.feature_integrations'](),
      description: m['settings.ai_support.feature_integrations_desc'](),
      icon: PlugZap,
      status: 'warning',
    },
    {
      label: m['settings.ai_support.feature_billing'](),
      description: m['settings.ai_support.feature_billing_desc'](),
      icon: CreditCard,
      status: 'warning',
    },
    {
      label: m['settings.ai_support.feature_usage'](),
      description: m['settings.ai_support.feature_usage_desc'](),
      icon: Activity,
      status: 'ready',
    },
    {
      label: m['settings.ai_support.feature_audit'](),
      description: m['settings.ai_support.feature_audit_desc'](),
      icon: History,
      status: 'ready',
    },
  ];
  const readinessValue = overview?.readiness ?? 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <Badge variant="outline" className="mb-3">
            {m['settings.ai_support.badge']()}
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight">{m['settings.ai_support.title']()}</h1>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            {m['settings.ai_support.description']()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <FileText className="size-4" />
            {m['settings.ai_support.open_prd']()}
          </Button>
          <Button disabled={overviewQuery.isFetching}>
            <ShieldCheck className="size-4" />
            {m['settings.ai_support.run_check']()}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{m['settings.ai_support.readiness_title']()}</CardTitle>
          <CardDescription>{m['settings.ai_support.readiness_description']()}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{m['settings.ai_support.readiness_label']()}</span>
            <span className="text-muted-foreground">{readinessValue}%</span>
          </div>
          <Progress value={readinessValue} />
          <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
            <div className="rounded-lg border border-border p-3">
              <p className="font-medium text-foreground">{m['settings.ai_support.guardrail_scope']()}</p>
              <p className="mt-1">{m['settings.ai_support.guardrail_scope_desc']()}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="font-medium text-foreground">{m['settings.ai_support.guardrail_approval']()}</p>
              <p className="mt-1">{m['settings.ai_support.guardrail_approval_desc']()}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="font-medium text-foreground">{m['settings.ai_support.guardrail_rollback']()}</p>
              <p className="mt-1">{m['settings.ai_support.guardrail_rollback_desc']()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="launch" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="operations">{m['settings.ai_support.tab_operations']()}</TabsTrigger>
          <TabsTrigger value="history">{m['settings.ai_support.tab_history']()}</TabsTrigger>
          <TabsTrigger value="usage">{m['settings.ai_support.tab_usage']()}</TabsTrigger>
          <TabsTrigger value="launch">{m['settings.ai_support.tab_launch']()}</TabsTrigger>
          <TabsTrigger value="knowledge">{m['settings.ai_support.tab_knowledge']()}</TabsTrigger>
          <TabsTrigger value="agent">{m['settings.ai_support.tab_agent']()}</TabsTrigger>
          <TabsTrigger value="surface">{m['settings.ai_support.tab_surface']()}</TabsTrigger>
        </TabsList>

        <TabsContent value="operations" className="space-y-4">
          <ChatbotOperations
            chatbots={chatbots}
            pending={createChatbotMutation.isPending || activateChatbotMutation.isPending}
            installCheckPending={checkInstallationMutation.isPending}
            onCreate={(input) => createChatbotMutation.mutateAsync(input).then(() => undefined)}
            onActivate={(chatbot) => activateChatbotMutation.mutateAsync(chatbot).then(() => undefined)}
            onCheckInstallation={(input) => checkInstallationMutation.mutateAsync(input)}
          />
          <div className="grid gap-4 xl:grid-cols-2">
            <KnowledgeOperations
              chatbots={chatbots}
              sources={knowledgeSources}
              pending={createKnowledgeMutation.isPending}
              onCreate={(input) => createKnowledgeMutation.mutateAsync(input).then(() => undefined)}
            />
            <AgentTokenOperations
              chatbots={chatbots}
              tokens={tokens}
              pending={createTokenMutation.isPending}
              revokePending={revokeTokenMutation.isPending}
              onCreate={(input) => createTokenMutation.mutateAsync(input).then(() => undefined)}
              onRevoke={(id) => revokeTokenMutation.mutateAsync(id).then(() => undefined)}
            />
          </div>
          <HumanSupportSettingsPanel
            chatbotId={primaryChatbotId}
            settings={humanSupportSettings}
            pending={updateHumanSupportSettingsMutation.isPending}
            onSave={(input) => updateHumanSupportSettingsMutation.mutateAsync(input).then(() => undefined)}
          />
          <SupportQueueOperations
            leads={leads}
            escalations={escalations}
            retryPending={retryEscalationNotificationsMutation.isPending}
            onRetryNotifications={(id) =>
              retryEscalationNotificationsMutation.mutateAsync(id).then(() => undefined)
            }
          />
          <AuditLogOperations logs={auditLogs} />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <ChatHistoryOperations
            conversations={conversations}
            selected={selectedConversation}
            selectedId={selectedConversationId}
            onSelect={setSelectedConversationId}
          />
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <UsageOperations usage={usage} />
        </TabsContent>

        <TabsContent value="launch" className="space-y-4">
          <LaunchOperationsPanel
            chatbotId={primaryChatbotId}
            settings={launchOperations}
            pending={updateLaunchOperationsMutation.isPending}
            onSave={(input) => updateLaunchOperationsMutation.mutateAsync(input).then(() => undefined)}
          />
          <LaunchChecklist items={launchItems} />
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-4">
          <KnowledgePanel sources={sources} />
        </TabsContent>

        <TabsContent value="agent" className="space-y-4">
          <AgentPolicyPanel policies={policies} />
          <div className="grid gap-4 xl:grid-cols-2">
            <AgentApprovalOperations
              chatbots={chatbots}
              runs={agentRuns}
              pending={createAgentRunMutation.isPending || reviewAgentRunMutation.isPending}
              onCreate={(input) => createAgentRunMutation.mutateAsync(input).then(() => undefined)}
              onReview={(input) => reviewAgentRunMutation.mutateAsync(input).then(() => undefined)}
            />
            <ConfigVersionOperations
              versions={configVersions}
              pending={rollbackConfigVersionMutation.isPending}
              onRollback={(id) => rollbackConfigVersionMutation.mutateAsync(id).then(() => undefined)}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <KeyRound className="size-5 text-primary" />
                <CardTitle className="text-base">{m['settings.ai_support.agent_token_title']()}</CardTitle>
                <CardDescription>{m['settings.ai_support.agent_token_desc']()}</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <RotateCcw className="size-5 text-primary" />
                <CardTitle className="text-base">{m['settings.ai_support.agent_diff_title']()}</CardTitle>
                <CardDescription>{m['settings.ai_support.agent_diff_desc']()}</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Globe2 className="size-5 text-primary" />
                <CardTitle className="text-base">{m['settings.ai_support.agent_mcp_title']()}</CardTitle>
                <CardDescription>{m['settings.ai_support.agent_mcp_desc']()}</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="surface" className="space-y-4">
          <WidgetAppearancePanel
            chatbotId={primaryChatbotId}
            settings={widgetAppearance}
            pending={updateWidgetAppearanceMutation.isPending}
            onSave={(input) => updateWidgetAppearanceMutation.mutateAsync(input).then(() => undefined)}
          />
          <FeatureGrid features={features} />
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>{m['settings.ai_support.next_title']()}</CardTitle>
          <CardDescription>{m['settings.ai_support.next_description']()}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border p-3">
            <p className="font-medium">{m['settings.ai_support.next_data']()}</p>
            <p className="mt-1 text-sm text-muted-foreground">{m['settings.ai_support.next_data_desc']()}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="font-medium">{m['settings.ai_support.next_api']()}</p>
            <p className="mt-1 text-sm text-muted-foreground">{m['settings.ai_support.next_api_desc']()}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="font-medium">{m['settings.ai_support.next_widget']()}</p>
            <p className="mt-1 text-sm text-muted-foreground">{m['settings.ai_support.next_widget_desc']()}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute('/settings/ai-support')({
  component: AiSupportPage,
});
