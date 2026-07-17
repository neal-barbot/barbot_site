import { and, asc, count, desc, eq, gt, isNull, like, or } from 'drizzle-orm';
import { db } from '@/core/db';
import { ResendProvider } from '@/core/email/resend';
import { envConfigs } from '@/config';
import {
  aiAgentRun,
  aiAgentToken,
  aiAuditLog,
  aiChatbot,
  aiConfigVersion,
  aiConversation,
  aiConversationMessage,
  aiConversationTag,
  aiHumanEscalation,
  aiKnowledgeChunk,
  aiKnowledgeGap,
  aiKnowledgeSource,
  aiKnowledgeSyncJob,
  aiLead,
  config,
  type AiChatbot,
  type AiAgentRun,
  type AiAuditLog,
  type AiConfigVersion,
  type AiConversation,
  type AiConversationMessage,
  type AiHumanEscalation,
  type AiKnowledgeSource,
  type AiKnowledgeChunk,
  type AiKnowledgeSyncJob as DbAiKnowledgeSyncJob,
  type AiLead,
} from '@/config/db/schema';
import { decryptSecret, isEncryptedSecret } from '@/lib/crypto';
import { getNonceStr, getUuid, md5 } from '@/lib/hash';
import { buildKnowledgeReply } from './reply-policy';
import { generateAnswerWithAgent } from './answer-agent';
import { questionMentionsCatalogPart } from '@/modules/chips/agent-tools';
import { consume as consumeCredits, getBalance } from '@/modules/credits/service';
import { getAllConfigs } from '@/modules/config/service';
import { fetchWebsiteKnowledge } from './providers';

export type AiSupportStatus = 'ready' | 'warning' | 'blocked';
export type ChatbotStatus = 'draft' | 'active' | 'paused' | 'archived';
export type ChatbotInstallStatus = 'not_installed' | 'installed' | 'error';
export type KnowledgeSourceType = 'custom_response' | 'text_snippet' | 'website_link' | 'file';
export type KnowledgeSourceStatus = 'draft' | 'ready' | 'needs_review' | 'archived';
export type LeadStatus = 'new' | 'qualified' | 'contacted' | 'closed' | 'spam';
export type LeadPriority = 'low' | 'normal' | 'high';
export type EscalationStatus = 'open' | 'assigned' | 'closed';
export type AgentRunStatus = 'queued' | 'running' | 'pending_approval' | 'approved' | 'rejected' | 'failed';

export interface AiSupportMetric {
  key: string;
  value: number;
  status: AiSupportStatus;
}

export interface AiSupportChecklistItem {
  key: string;
  status: AiSupportStatus;
}

export interface AiKnowledgeSourceSummary {
  type: KnowledgeSourceType;
  total: number;
  ready: number;
  needsReview: number;
}

export interface AiAgentPolicySummary {
  identity: string;
  scope: string;
  access: string;
  approval: string;
}

export interface AiSupportOverview {
  readiness: number;
  metrics: AiSupportMetric[];
  checklist: AiSupportChecklistItem[];
  knowledgeSources: AiKnowledgeSourceSummary[];
  agentPolicies: AiAgentPolicySummary[];
  pendingApprovals: number;
  recentAgentRuns: Array<{
    id: string;
    action: string;
    status: string;
    approvalRequired: boolean;
    summary: string;
    createdAt: Date | null;
  }>;
}

export interface AiSupportUsage {
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
}

type NotificationDelivery =
  | { status: 'sent'; channel: 'webhook' | 'email'; statusCode?: number | null; messageId?: string; checkedAt: string }
  | { status: 'failed'; channel: 'webhook' | 'email'; statusCode?: number | null; error: string; checkedAt: string };

export interface HumanSupportSettings {
  enabled: boolean;
  showEscalationButtons: boolean;
  replaceSuggestions: boolean;
  positivePrompt: string;
  requestPrompt: string;
  confirmationMessage: string;
  notificationsEnabled: boolean;
  notificationEmail: string;
  notificationWebhookUrl: string;
}

export interface WidgetAppearanceSettings {
  displayName: string;
  welcomeMessage: string;
  placeholder: string;
  launcherLabel: string;
  primaryColor: string;
}

export interface LaunchOperationsSettings {
  backupConfigured: boolean;
  backupRunbookUrl: string;
  errorAlertsEnabled: boolean;
  errorAlertWebhookUrl: string;
  logRetentionDays: number;
  rateLimitEnabled: boolean;
  domainWhitelistRequired: boolean;
}

export interface PromptPersonaSettings {
  instructions: string;
  persona: string;
}

export interface ConversationButton {
  id: string;
  label: string;
  action: 'message' | 'link' | 'escalate';
  value: string;
  enabled: boolean;
  locale: string;
}

export interface LocalizationSettings {
  defaultLocale: string;
  timezone: string;
  autoDetectLocale: boolean;
  labels: Record<string, string>;
}

export interface CreateChatbotInput {
  userId: string;
  name: string;
  description?: string;
  allowedDomains?: string[];
}

export interface UpdateChatbotInput {
  userId: string;
  id: string;
  name?: string;
  description?: string;
  status?: ChatbotStatus;
  installStatus?: ChatbotInstallStatus;
  allowedDomains?: string[];
}

export interface CheckChatbotInstallationInput {
  userId: string;
  chatbotId: string;
  url: string;
}

export interface CheckChatbotInstallationResult {
  url: string;
  normalizedUrl: string;
  installed: boolean;
  installStatus: ChatbotInstallStatus;
  statusCode: number | null;
  reason: string;
  detectedPublicKey: string | null;
  checkedAt: string;
}

export interface CreateKnowledgeSourceInput {
  userId: string;
  chatbotId: string;
  type: KnowledgeSourceType;
  title: string;
  content?: string;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateKnowledgeSourceInput {
  userId: string;
  id: string;
  title?: string;
  content?: string;
  sourceUrl?: string;
  status?: KnowledgeSourceStatus;
  metadata?: Record<string, unknown>;
}

export interface AiKnowledgeSyncJob {
  id: string;
  chatbotId: string;
  sourceId: string;
  sourceType: KnowledgeSourceType;
  title: string;
  status: 'pending' | 'synced' | 'failed';
  attempts: number;
  lastError: string | null;
  lastSyncedAt: Date | null;
  updatedAt: Date;
}

export interface CreateLeadInput {
  userId: string;
  chatbotId: string;
  conversationId?: string;
  name?: string;
  email?: string;
  phone?: string;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateLeadInput {
  userId: string;
  id: string;
  status?: LeadStatus;
  priority?: LeadPriority;
  metadata?: Record<string, unknown>;
}

export interface CreateEscalationInput {
  userId: string;
  chatbotId: string;
  leadId?: string;
  conversationId?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateEscalationInput {
  userId: string;
  id: string;
  status?: EscalationStatus;
  assigneeUserId?: string | null;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export interface AiConversationWithMessages extends AiConversation {
  messages: AiConversationMessage[];
}

export interface PublicConversationMessageInput {
  publicKey: string;
  conversationId?: string;
  message: string;
  visitorId?: string;
  sourceUrl?: string;
  contactName?: string;
  contactEmail?: string;
  metadata?: Record<string, unknown>;
}

export interface PublicConversationMessageResult {
  conversation: AiConversation;
  userMessage: AiConversationMessage;
  assistantMessage: AiConversationMessage;
}

export interface AiAgentTokenView {
  id: string;
  name: string;
  status: string;
  accessProfile: string;
  scopes: string[];
  chatbotIds: string[];
  tokenPrefix: string;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface CreateAgentRunInput {
  userId: string;
  chatbotId: string;
  action: string;
  summary: string;
  settingKey: string;
  content: string;
  agentTokenId?: string;
}

export interface ReviewAgentRunInput {
  userId: string;
  id: string;
  decision: 'approve' | 'reject';
}

export interface RollbackConfigVersionInput {
  userId: string;
  id: string;
}

export interface UpdateHumanSupportSettingsInput {
  userId: string;
  chatbotId: string;
  settings: Partial<HumanSupportSettings>;
}

export interface UpdateWidgetAppearanceInput {
  userId: string;
  chatbotId: string;
  settings: Partial<WidgetAppearanceSettings>;
}

export interface UpdateLaunchOperationsInput {
  userId: string;
  chatbotId: string;
  settings: Partial<LaunchOperationsSettings>;
}

export interface UpdatePromptPersonaInput {
  userId: string;
  chatbotId: string;
  settings: Partial<PromptPersonaSettings>;
}

export interface UpdateWorkspaceSettingInput<T> {
  userId: string;
  chatbotId: string;
  settingKey: string;
  content: T;
  requiresApproval?: boolean;
}

const KNOWLEDGE_TYPES: KnowledgeSourceType[] = [
  'custom_response',
  'text_snippet',
  'website_link',
  'file',
];

const CHATBOT_STATUSES: ChatbotStatus[] = ['draft', 'active', 'paused', 'archived'];
const CHATBOT_INSTALL_STATUSES: ChatbotInstallStatus[] = [
  'not_installed',
  'installed',
  'error',
];
const KNOWLEDGE_STATUSES: KnowledgeSourceStatus[] = [
  'draft',
  'ready',
  'needs_review',
  'archived',
];
const LEAD_STATUSES: LeadStatus[] = ['new', 'qualified', 'contacted', 'closed', 'spam'];
const LEAD_PRIORITIES: LeadPriority[] = ['low', 'normal', 'high'];
const ESCALATION_STATUSES: EscalationStatus[] = ['open', 'assigned', 'closed'];
const AGENT_RUN_STATUSES: AgentRunStatus[] = [
  'queued',
  'running',
  'pending_approval',
  'approved',
  'rejected',
  'failed',
];

const STANDARD_AGENT_POLICIES: AiAgentPolicySummary[] = [
  {
    identity: 'Codex Ops',
    scope: 'knowledge,prompt,launch_health',
    access: 'read,propose,dry_run',
    approval: 'publish,delete,external_send',
  },
  {
    identity: 'Hermes Support',
    scope: 'leads,escalations,conversations',
    access: 'read,classify,draft',
    approval: 'external_send,lead_export',
  },
  {
    identity: 'Billing Guard',
    scope: 'billing,members,integrations',
    access: 'read_only',
    approval: 'writes_disabled_by_default',
  },
];

const DEFAULT_AGENT_SCOPES = [
  'dashboard.read',
  'healthcheck.run',
  'knowledge.read',
  'knowledge.propose',
  'conversation.read',
  'lead.read',
  'lead.classify',
  'audit.read',
];

function activeAgentTokenWhere(userId: string, now = new Date()) {
  return and(
    eq(aiAgentToken.userId, userId),
    eq(aiAgentToken.status, 'active'),
    or(isNull(aiAgentToken.expiresAt), gt(aiAgentToken.expiresAt, now))
  );
}

const HUMAN_SUPPORT_SETTING_KEY = 'human_support.settings';
const WIDGET_APPEARANCE_SETTING_KEY = 'widget.appearance';
const LAUNCH_OPERATIONS_SETTING_KEY = 'launch.operations';
const PROMPT_INSTRUCTIONS_SETTING_KEY = 'chatbot.instructions';
const PROMPT_PERSONA_SETTING_KEY = 'chatbot.persona';
const CONVERSATION_STARTERS_SETTING_KEY = 'conversation.starters';
const CONVERSATION_FOLLOWUPS_SETTING_KEY = 'conversation.followups';
const LOCALIZATION_SETTING_KEY = 'chatbot.localization';
const DEFAULT_HUMAN_SUPPORT_SETTINGS: HumanSupportSettings = {
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
};
const DEFAULT_WIDGET_APPEARANCE: WidgetAppearanceSettings = {
  displayName: 'AI Support',
  welcomeMessage: 'Leave your contact details and we will help from here.',
  placeholder: 'How can we help?',
  launcherLabel: '?',
  primaryColor: '#2563eb',
};
const DEFAULT_LAUNCH_OPERATIONS: LaunchOperationsSettings = {
  backupConfigured: false,
  backupRunbookUrl: '',
  errorAlertsEnabled: false,
  errorAlertWebhookUrl: '',
  logRetentionDays: 14,
  rateLimitEnabled: true,
  domainWhitelistRequired: true,
};
const DEFAULT_PROMPT_PERSONA: PromptPersonaSettings = {
  instructions:
    'Answer from approved knowledge sources first. Ask for contact details when the user needs follow-up.',
  persona:
    'Helpful, concise, and careful support agent. Escalate clearly when confidence is low.',
};
const DEFAULT_LOCALIZATION: LocalizationSettings = {
  defaultLocale: 'en',
  timezone: 'UTC',
  autoDetectLocale: true,
  labels: {},
};

function assertKnowledgeType(type: string): asserts type is KnowledgeSourceType {
  if (!KNOWLEDGE_TYPES.includes(type as KnowledgeSourceType)) {
    throw new Error('Invalid knowledge source type');
  }
}

function assertOneOf<T extends string>(
  value: string,
  allowed: readonly T[],
  label: string
): asserts value is T {
  if (!allowed.includes(value as T)) {
    throw new Error(`Invalid ${label}`);
  }
}

async function assertOwnsChatbot(userId: string, chatbotId: string): Promise<void> {
  const [row] = await db()
    .select({ id: aiChatbot.id })
    .from(aiChatbot)
    .where(
      and(
        eq(aiChatbot.id, chatbotId),
        eq(aiChatbot.userId, userId),
        isNull(aiChatbot.deletedAt)
      )
    )
    .limit(1);
  if (!row) throw new Error('Chatbot not found');
}

async function writeAudit(tx: any, input: {
  userId: string;
  actorType?: 'user' | 'agent';
  actorId?: string;
  resourceType: string;
  resourceId: string;
  action: string;
  requiresApproval?: boolean;
  status?: string;
  diff?: unknown;
  metadata?: Record<string, unknown>;
}) {
  await tx.insert(aiAuditLog).values({
    id: getUuid(),
    userId: input.userId,
    actorType: input.actorType ?? 'user',
    actorId: input.actorId ?? input.userId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    action: input.action,
    requiresApproval: input.requiresApproval ?? false,
    status: input.status ?? 'recorded',
    diff: input.diff === undefined ? null : JSON.stringify(input.diff),
    metadata: JSON.stringify(input.metadata ?? {}),
    createdAt: new Date(),
  });
}

function parseJsonStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function parseJsonObject(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function redactPiiText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/\b([A-Z0-9._%+-])([A-Z0-9._%+-]*)(@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi, (_match, first, middle, domain) => {
      const masked = middle ? `${'*'.repeat(Math.min(String(middle).length, 6))}` : '*';
      return `${first}${masked}${domain}`;
    })
    .replace(/(?<!\d)(\+?\d[\d\s().-]{6,}\d)(?!\d)/g, (match) => {
      const digits = match.replace(/\D/g, '');
      if (digits.length < 7) return match;
      return `${digits.slice(0, 2)}${'*'.repeat(Math.max(digits.length - 4, 3))}${digits.slice(-2)}`;
    });
}

function maskNullable(value: string | null): string | null {
  return value ? redactPiiText(value) : value;
}

function redactLead(row: AiLead): AiLead {
  return {
    ...row,
    name: maskNullable(row.name),
    email: maskNullable(row.email),
    phone: maskNullable(row.phone),
  };
}

function redactConversation(row: AiConversation): AiConversation {
  return {
    ...row,
    contactName: maskNullable(row.contactName),
    contactEmail: maskNullable(row.contactEmail),
    lastMessage: redactPiiText(row.lastMessage),
  };
}

function redactConversationMessage(row: AiConversationMessage): AiConversationMessage {
  return {
    ...row,
    content: redactPiiText(row.content),
  };
}

function parseHumanSupportSettings(raw: string | null): HumanSupportSettings {
  const parsed = parseJsonObject(raw);
  return {
    enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_HUMAN_SUPPORT_SETTINGS.enabled,
    showEscalationButtons:
      typeof parsed.showEscalationButtons === 'boolean'
        ? parsed.showEscalationButtons
        : DEFAULT_HUMAN_SUPPORT_SETTINGS.showEscalationButtons,
    replaceSuggestions:
      typeof parsed.replaceSuggestions === 'boolean'
        ? parsed.replaceSuggestions
        : DEFAULT_HUMAN_SUPPORT_SETTINGS.replaceSuggestions,
    positivePrompt:
      typeof parsed.positivePrompt === 'string'
        ? parsed.positivePrompt
        : DEFAULT_HUMAN_SUPPORT_SETTINGS.positivePrompt,
    requestPrompt:
      typeof parsed.requestPrompt === 'string'
        ? parsed.requestPrompt
        : DEFAULT_HUMAN_SUPPORT_SETTINGS.requestPrompt,
    confirmationMessage:
      typeof parsed.confirmationMessage === 'string'
        ? parsed.confirmationMessage
        : DEFAULT_HUMAN_SUPPORT_SETTINGS.confirmationMessage,
    notificationsEnabled:
      typeof parsed.notificationsEnabled === 'boolean'
        ? parsed.notificationsEnabled
        : DEFAULT_HUMAN_SUPPORT_SETTINGS.notificationsEnabled,
    notificationEmail:
      typeof parsed.notificationEmail === 'string'
        ? parsed.notificationEmail
        : DEFAULT_HUMAN_SUPPORT_SETTINGS.notificationEmail,
    notificationWebhookUrl:
      typeof parsed.notificationWebhookUrl === 'string'
        ? parsed.notificationWebhookUrl
        : DEFAULT_HUMAN_SUPPORT_SETTINGS.notificationWebhookUrl,
  };
}

function normalizeHumanSupportSettings(
  input: Partial<HumanSupportSettings>,
  current: HumanSupportSettings
): HumanSupportSettings {
  return {
    ...current,
    ...input,
    positivePrompt: (input.positivePrompt ?? current.positivePrompt).trim().slice(0, 160),
    requestPrompt: (input.requestPrompt ?? current.requestPrompt).trim().slice(0, 160),
    confirmationMessage: (input.confirmationMessage ?? current.confirmationMessage).trim().slice(0, 1000),
    notificationEmail: (input.notificationEmail ?? current.notificationEmail).trim().slice(0, 254),
    notificationWebhookUrl: (input.notificationWebhookUrl ?? current.notificationWebhookUrl).trim().slice(0, 500),
  };
}

function normalizeWidgetColor(input: string): string {
  const color = input.trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_WIDGET_APPEARANCE.primaryColor;
}

function parseWidgetAppearance(raw: string | null): WidgetAppearanceSettings {
  const parsed = parseJsonObject(raw);
  return {
    displayName:
      typeof parsed.displayName === 'string'
        ? parsed.displayName
        : DEFAULT_WIDGET_APPEARANCE.displayName,
    welcomeMessage:
      typeof parsed.welcomeMessage === 'string'
        ? parsed.welcomeMessage
        : DEFAULT_WIDGET_APPEARANCE.welcomeMessage,
    placeholder:
      typeof parsed.placeholder === 'string'
        ? parsed.placeholder
        : DEFAULT_WIDGET_APPEARANCE.placeholder,
    launcherLabel:
      typeof parsed.launcherLabel === 'string'
        ? parsed.launcherLabel
        : DEFAULT_WIDGET_APPEARANCE.launcherLabel,
    primaryColor:
      typeof parsed.primaryColor === 'string'
        ? normalizeWidgetColor(parsed.primaryColor)
        : DEFAULT_WIDGET_APPEARANCE.primaryColor,
  };
}

function normalizeWidgetAppearance(
  input: Partial<WidgetAppearanceSettings>,
  current: WidgetAppearanceSettings
): WidgetAppearanceSettings {
  return {
    displayName: (input.displayName ?? current.displayName).trim().slice(0, 80) || current.displayName,
    welcomeMessage: (input.welcomeMessage ?? current.welcomeMessage).trim().slice(0, 240) || current.welcomeMessage,
    placeholder: (input.placeholder ?? current.placeholder).trim().slice(0, 120) || current.placeholder,
    launcherLabel: (input.launcherLabel ?? current.launcherLabel).trim().slice(0, 16) || current.launcherLabel,
    primaryColor: normalizeWidgetColor(input.primaryColor ?? current.primaryColor),
  };
}

function normalizePromptPersona(
  input: Partial<PromptPersonaSettings>,
  current: PromptPersonaSettings
): PromptPersonaSettings {
  return {
    instructions:
      (input.instructions ?? current.instructions).trim().slice(0, 8000) ||
      current.instructions,
    persona:
      (input.persona ?? current.persona).trim().slice(0, 4000) ||
      current.persona,
  };
}

function parseLaunchOperations(raw: string | null): LaunchOperationsSettings {
  const parsed = parseJsonObject(raw);
  const logRetentionDays = Number(parsed.logRetentionDays);
  return {
    backupConfigured:
      typeof parsed.backupConfigured === 'boolean'
        ? parsed.backupConfigured
        : DEFAULT_LAUNCH_OPERATIONS.backupConfigured,
    backupRunbookUrl:
      typeof parsed.backupRunbookUrl === 'string'
        ? parsed.backupRunbookUrl
        : DEFAULT_LAUNCH_OPERATIONS.backupRunbookUrl,
    errorAlertsEnabled:
      typeof parsed.errorAlertsEnabled === 'boolean'
        ? parsed.errorAlertsEnabled
        : DEFAULT_LAUNCH_OPERATIONS.errorAlertsEnabled,
    errorAlertWebhookUrl:
      typeof parsed.errorAlertWebhookUrl === 'string'
        ? parsed.errorAlertWebhookUrl
        : DEFAULT_LAUNCH_OPERATIONS.errorAlertWebhookUrl,
    logRetentionDays:
      Number.isFinite(logRetentionDays) && logRetentionDays > 0
        ? Math.min(Math.floor(logRetentionDays), 365)
        : DEFAULT_LAUNCH_OPERATIONS.logRetentionDays,
    rateLimitEnabled:
      typeof parsed.rateLimitEnabled === 'boolean'
        ? parsed.rateLimitEnabled
        : DEFAULT_LAUNCH_OPERATIONS.rateLimitEnabled,
    domainWhitelistRequired:
      typeof parsed.domainWhitelistRequired === 'boolean'
        ? parsed.domainWhitelistRequired
        : DEFAULT_LAUNCH_OPERATIONS.domainWhitelistRequired,
  };
}

function normalizeLaunchOperations(
  input: Partial<LaunchOperationsSettings>,
  current: LaunchOperationsSettings
): LaunchOperationsSettings {
  const logRetentionDays = Number(input.logRetentionDays ?? current.logRetentionDays);
  const backupRunbookUrl = (input.backupRunbookUrl ?? current.backupRunbookUrl).trim().slice(0, 500);
  const errorAlertWebhookUrl = (input.errorAlertWebhookUrl ?? current.errorAlertWebhookUrl).trim().slice(0, 500);

  return {
    backupConfigured: input.backupConfigured ?? current.backupConfigured,
    backupRunbookUrl: backupRunbookUrl ? normalizeOutboundHttpUrl(backupRunbookUrl, 'Backup runbook URL').toString() : '',
    errorAlertsEnabled: input.errorAlertsEnabled ?? current.errorAlertsEnabled,
    errorAlertWebhookUrl: errorAlertWebhookUrl
      ? normalizeWebhookUrl(errorAlertWebhookUrl).toString()
      : '',
    logRetentionDays:
      Number.isFinite(logRetentionDays) && logRetentionDays > 0
        ? Math.min(Math.floor(logRetentionDays), 365)
        : current.logRetentionDays,
    rateLimitEnabled: input.rateLimitEnabled ?? current.rateLimitEnabled,
    domainWhitelistRequired: input.domainWhitelistRequired ?? current.domainWhitelistRequired,
  };
}

function normalizeOutboundHttpUrl(rawUrl: string, label: string, opts: { requireHttps?: boolean } = {}): URL {
  const trimmed = rawUrl.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  if (trimmed.length > 2048) throw new Error(`${label} is too long`);

  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error(`${label} is invalid`);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${label} must use http or https`);
  }
  if (opts.requireHttps && url.protocol !== 'https:') {
    throw new Error(`${label} must use https`);
  }
  if (url.username || url.password) {
    throw new Error(`${label} cannot include credentials`);
  }

  const hostname = url.hostname.toLowerCase();
  if (isBlockedInstallHostname(hostname)) {
    throw new Error(`${label} cannot target localhost or private network hosts`);
  }

  return url;
}

function normalizePublicUrl(rawUrl: string): URL {
  return normalizeOutboundHttpUrl(rawUrl, 'Installation URL');
}

function normalizeWebhookUrl(rawUrl: string): URL {
  return normalizeOutboundHttpUrl(rawUrl, 'Notification webhook URL', { requireHttps: true });
}

function redactSecretUrl(rawUrl: string | null | undefined): string {
  if (!rawUrl) return '';
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname.slice(0, 24)}${url.pathname.length > 24 ? '...' : ''}`;
  } catch {
    return rawUrl.slice(0, 12) ? `${rawUrl.slice(0, 12)}...` : '';
  }
}

function redactHumanSupportSettingsContent(raw: string | null): string {
  const parsed = parseJsonObject(raw);
  return JSON.stringify({
    ...parsed,
    notificationEmail:
      typeof parsed.notificationEmail === 'string'
        ? redactPiiText(parsed.notificationEmail)
        : parsed.notificationEmail,
    notificationWebhookUrl:
      typeof parsed.notificationWebhookUrl === 'string'
        ? redactSecretUrl(parsed.notificationWebhookUrl)
        : parsed.notificationWebhookUrl,
  });
}

function redactLaunchOperationsContent(raw: string | null): string {
  const parsed = parseJsonObject(raw);
  return JSON.stringify({
    ...parsed,
    errorAlertWebhookUrl:
      typeof parsed.errorAlertWebhookUrl === 'string'
        ? redactSecretUrl(parsed.errorAlertWebhookUrl)
        : parsed.errorAlertWebhookUrl,
  });
}

function isBlockedInstallHostname(hostname: string): boolean {
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '0.0.0.0' ||
    hostname === '[::1]' ||
    hostname === '::1'
  ) {
    return true;
  }

  if (hostname.includes(':')) {
    return (
      hostname === '::' ||
      hostname.startsWith('fc') ||
      hostname.startsWith('fd') ||
      hostname.startsWith('fe80:')
    );
  }

  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;

  const parts = ipv4.slice(1).map((part) => Number(part));
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

async function readLimitedResponseText(response: Response, maxBytes = 262_144): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return response.text();

  const chunks: Uint8Array[] = [];
  let received = 0;
  while (received < maxBytes) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    const remaining = maxBytes - received;
    chunks.push(value.byteLength > remaining ? value.slice(0, remaining) : value);
    received += Math.min(value.byteLength, remaining);
  }
  await reader.cancel().catch(() => undefined);

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function fetchInstallCheckPage(url: URL, signal: AbortSignal): Promise<Response> {
  let nextUrl = url;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetch(nextUrl.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal,
      headers: {
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'user-agent': 'ShipAny-AI-Support-Install-Check/1.0',
      },
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }

    const location = response.headers.get('location');
    if (!location) return response;
    nextUrl = normalizePublicUrl(new URL(location, nextUrl).toString());
  }

  throw new Error('Installation check followed too many redirects');
}

async function postJsonWebhook(url: URL, payload: unknown): Promise<{ ok: boolean; statusCode: number | null; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'user-agent': 'ShipAny-AI-Support-Webhook/1.0',
      },
      body: JSON.stringify(payload),
    });
    return {
      ok: response.ok,
      statusCode: response.status,
      error: response.ok ? undefined : `Webhook returned HTTP ${response.status}`,
    };
  } catch (error: any) {
    return {
      ok: false,
      statusCode: null,
      error: error?.name === 'AbortError' ? 'Webhook delivery timed out' : error?.message || 'Webhook delivery failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function readEmailProviderConfigs(): Promise<{ apiKey: string; from: string; appName: string }> {
  const dbConfigs: Record<string, string> = {};
  try {
    const rows = await db()
      .select({
        name: config.name,
        value: config.value,
      })
      .from(config);

    for (const row of rows) {
      if (!row.name || !row.value) continue;
      if (isEncryptedSecret(row.value)) {
        const plain = await decryptSecret(row.value);
        if (plain !== null) dbConfigs[row.name] = plain;
      } else {
        dbConfigs[row.name] = row.value;
      }
    }
  } catch {
    // Fall back to env configs; notification failure is recorded by the caller.
  }

  const merged = { ...envConfigs, ...dbConfigs };
  return {
    apiKey: merged.resend_api_key || '',
    from: merged.resend_sender_email || '',
    appName: merged.app_name || envConfigs.app_name || 'ShipAny',
  };
}

async function sendEscalationEmail(input: {
  to: string;
  chatbotName: string;
  escalation: AiHumanEscalation;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const to = input.to.trim();
  if (!to) return { ok: false, error: 'Notification email is not configured' };

  const configs = await readEmailProviderConfigs();
  if (!configs.apiKey || !configs.from) {
    return { ok: false, error: 'Resend is not configured' };
  }

  const provider = new ResendProvider({
    apiKey: configs.apiKey,
    defaultFrom: configs.from,
  });
  const createdAt = input.escalation.createdAt?.toISOString?.() ?? String(input.escalation.createdAt ?? '');
  const result = await provider.sendEmail({
    to,
    subject: `[${configs.appName}] Human support request - ${input.chatbotName}`,
    text: [
      `A visitor requested human support for ${input.chatbotName}.`,
      '',
      `Escalation ID: ${input.escalation.id}`,
      `Status: ${input.escalation.status}`,
      `Created: ${createdAt}`,
      input.escalation.conversationId ? `Conversation ID: ${input.escalation.conversationId}` : '',
      input.escalation.leadId ? `Lead ID: ${input.escalation.leadId}` : '',
      '',
      `Summary: ${redactPiiText(input.escalation.summary) || 'No summary provided.'}`,
    ]
      .filter(Boolean)
      .join('\n'),
  });

  return result.success
    ? { ok: true, messageId: result.messageId }
    : { ok: false, error: result.error || 'Email delivery failed' };
}

function readNotificationDeliveries(metadata: Record<string, unknown>): NotificationDelivery[] {
  const raw = Array.isArray(metadata.notificationDeliveries)
    ? metadata.notificationDeliveries
    : metadata.notificationDelivery
      ? [metadata.notificationDelivery]
      : [];
  const deliveries: NotificationDelivery[] = [];

  for (const item of raw) {
    const delivery = item && typeof item === 'object' && !Array.isArray(item)
      ? (item as Record<string, unknown>)
      : {};
    const channel = delivery.channel === 'email' || delivery.channel === 'webhook'
      ? delivery.channel
      : null;
    const status = delivery.status === 'sent' || delivery.status === 'failed'
      ? delivery.status
      : null;
    const checkedAt = typeof delivery.checkedAt === 'string' ? delivery.checkedAt : new Date().toISOString();
    if (!channel || !status) continue;

    deliveries.push(
      status === 'sent'
        ? {
          status,
          channel,
          statusCode: typeof delivery.statusCode === 'number' ? delivery.statusCode : undefined,
          messageId: typeof delivery.messageId === 'string' ? delivery.messageId : undefined,
          checkedAt,
        }
        : {
          status,
          channel,
          statusCode: typeof delivery.statusCode === 'number' ? delivery.statusCode : undefined,
          error: typeof delivery.error === 'string' ? delivery.error : 'Delivery failed',
          checkedAt,
        }
    );
  }

  return deliveries;
}

function syncJobView(source: AiKnowledgeSource, job?: DbAiKnowledgeSyncJob): AiKnowledgeSyncJob {
  return {
    id: job?.id ?? source.id,
    chatbotId: source.chatbotId,
    sourceId: source.id,
    sourceType: source.type as KnowledgeSourceType,
    title: source.title,
    status: job?.status === 'failed' ? 'failed' : job?.status === 'synced' ? 'synced' : 'pending',
    attempts: job?.attempts ?? 0,
    lastError: job?.lastError ?? null,
    lastSyncedAt: source.lastSyncedAt,
    updatedAt: job?.updatedAt ?? source.updatedAt,
  };
}

function chunkKnowledgeText(value: string): string[] {
  const normalized = value.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  const maxLength = 1200;
  for (let offset = 0; offset < normalized.length; offset += maxLength - 160) {
    const chunk = normalized.slice(offset, offset + maxLength).trim();
    if (chunk) chunks.push(chunk);
    if (offset + maxLength >= normalized.length) break;
  }
  return chunks.slice(0, 200);
}

async function replaceKnowledgeChunks(tx: any, source: AiKnowledgeSource, content: string) {
  const chunks = chunkKnowledgeText(content);
  await tx.delete(aiKnowledgeChunk).where(eq(aiKnowledgeChunk.sourceId, source.id));
  if (chunks.length) {
    await tx.insert(aiKnowledgeChunk).values(chunks.map((chunk, ordinal) => ({
      id: getUuid(),
      userId: source.userId,
      chatbotId: source.chatbotId,
      sourceId: source.id,
      ordinal,
      content: chunk,
      checksum: md5(chunk),
      createdAt: new Date(),
    })));
  }
  return chunks.length;
}

async function deliverEscalationNotifications(input: {
  userId: string;
  chatbot: Pick<AiChatbot, 'id' | 'name'>;
  escalation: AiHumanEscalation;
  settings: HumanSupportSettings;
  actorId: string;
  retry?: boolean;
  channels?: Array<NotificationDelivery['channel']>;
}): Promise<AiHumanEscalation> {
  if (!input.settings.notificationsEnabled) {
    return input.escalation;
  }

  const deliveries: NotificationDelivery[] = [];
  const shouldSendEmail = !input.channels || input.channels.includes('email');
  const shouldSendWebhook = !input.channels || input.channels.includes('webhook');

  if (shouldSendEmail && input.settings.notificationEmail) {
    const checkedAt = new Date().toISOString();
    try {
      const result = await sendEscalationEmail({
        to: input.settings.notificationEmail,
        chatbotName: input.chatbot.name,
        escalation: input.escalation,
      });
      deliveries.push(
        result.ok
          ? {
              status: 'sent',
              channel: 'email',
              messageId: result.messageId,
              checkedAt,
            }
          : {
              status: 'failed',
              channel: 'email',
              error: result.error || 'Email delivery failed',
              checkedAt,
            }
      );
    } catch (error: any) {
      deliveries.push({
        status: 'failed',
        channel: 'email',
        error: error?.message || 'Email delivery failed',
        checkedAt,
      });
    }
  }

  if (shouldSendWebhook && input.settings.notificationWebhookUrl) {
    const checkedAt = new Date().toISOString();
    try {
      const webhookUrl = normalizeWebhookUrl(input.settings.notificationWebhookUrl);
      const result = await postJsonWebhook(webhookUrl, {
        event: input.retry
          ? 'ai_support.escalation.notification_retry'
          : 'ai_support.escalation.created',
        escalation: {
          id: input.escalation.id,
          status: input.escalation.status,
          summary: redactPiiText(input.escalation.summary),
          leadId: input.escalation.leadId,
          conversationId: input.escalation.conversationId,
          createdAt: input.escalation.createdAt?.toISOString?.() ?? input.escalation.createdAt,
        },
        chatbot: {
          id: input.chatbot.id,
          name: input.chatbot.name,
        },
      });

      deliveries.push(
        result.ok
          ? {
              status: 'sent',
              channel: 'webhook',
              statusCode: result.statusCode,
              checkedAt,
            }
          : {
              status: 'failed',
              channel: 'webhook',
              statusCode: result.statusCode,
              error: result.error || 'Webhook delivery failed',
              checkedAt,
            }
      );
    } catch (error: any) {
      deliveries.push({
        status: 'failed',
        channel: 'webhook',
        statusCode: null,
        error: error?.message || 'Webhook delivery failed',
        checkedAt,
      });
    }
  }

  if (deliveries.length === 0) {
    return input.escalation;
  }

  const currentMetadata = parseJsonObject(input.escalation.metadata);
  const previousDeliveries = readNotificationDeliveries(currentMetadata);
  const metadata = {
    ...currentMetadata,
    notificationDelivery: deliveries[deliveries.length - 1],
    notificationDeliveries: [...previousDeliveries, ...deliveries],
    notificationLastRetriedAt: input.retry ? new Date().toISOString() : currentMetadata.notificationLastRetriedAt,
  };

  const [updated] = await db()
    .update(aiHumanEscalation)
    .set({
      metadata: JSON.stringify(metadata),
      updatedAt: new Date(),
    })
    .where(and(eq(aiHumanEscalation.id, input.escalation.id), eq(aiHumanEscalation.userId, input.userId)))
    .returning();

  await db().transaction(async (tx: any) => {
    for (const delivery of deliveries) {
      await writeAudit(tx, {
        userId: input.userId,
        actorType: 'agent',
        actorId: input.actorId,
        resourceType: 'ai_human_escalation',
        resourceId: input.escalation.id,
        action: `escalation.notification.${delivery.channel}${input.retry ? '.retry' : ''}`,
        status: delivery.status === 'sent' ? 'recorded' : 'failed',
        metadata: {
          chatbotId: input.chatbot.id,
          channel: delivery.channel,
          statusCode: 'statusCode' in delivery ? delivery.statusCode : undefined,
          messageId: 'messageId' in delivery ? delivery.messageId : undefined,
          email: delivery.channel === 'email' ? redactPiiText(input.settings.notificationEmail) : undefined,
          webhook:
            delivery.channel === 'webhook'
              ? redactSecretUrl(input.settings.notificationWebhookUrl)
              : undefined,
          retry: Boolean(input.retry),
          error: delivery.status === 'failed' ? delivery.error : undefined,
        },
      });
    }
  });

  return updated ?? input.escalation;
}

function detectWidgetInstall(html: string, chatbot: Pick<AiChatbot, 'publicKey'>) {
  const lowerHtml = html.toLowerCase();
  const hasWidgetScript = lowerHtml.includes('ai-support-widget.js');
  const hasPublicKey = html.includes(chatbot.publicKey);
  const hasBootstrapAttribute = lowerHtml.includes('data-ai-support-public-key');

  return {
    installed: hasWidgetScript && (hasPublicKey || hasBootstrapAttribute),
    detectedPublicKey: hasPublicKey ? chatbot.publicKey : null,
  };
}

function buildCitation(source: AiKnowledgeSource) {
  return {
    id: source.id,
    type: source.type,
    title: source.title,
    sourceUrl: source.sourceUrl,
  };
}

function parseAgentConfigDiff(raw: string | null): {
  target?: string;
  settingKey?: string;
  content?: string;
} {
  const parsed = parseJsonObject(raw);
  return {
    target: typeof parsed.target === 'string' ? parsed.target : undefined,
    settingKey: typeof parsed.settingKey === 'string' ? parsed.settingKey : undefined,
    content: typeof parsed.content === 'string' ? parsed.content : undefined,
  };
}

async function getNextConfigVersion(
  tx: any,
  input: { userId: string; chatbotId: string; settingKey: string }
): Promise<number> {
  const [latest] = await tx
    .select({ version: aiConfigVersion.version })
    .from(aiConfigVersion)
    .where(
      and(
        eq(aiConfigVersion.userId, input.userId),
        eq(aiConfigVersion.chatbotId, input.chatbotId),
        eq(aiConfigVersion.settingKey, input.settingKey)
      )
    )
    .orderBy(desc(aiConfigVersion.version))
    .limit(1);

  return Number(latest?.version ?? 0) + 1;
}

async function publishConfigVersion(
  tx: any,
  input: {
    userId: string;
    chatbotId: string;
    settingKey: string;
    content: string;
    createdByType: 'user' | 'agent';
    createdById?: string | null;
    approvedByUserId: string;
  }
): Promise<AiConfigVersion> {
  const now = new Date();
  await tx
    .update(aiConfigVersion)
    .set({ status: 'superseded' })
    .where(
      and(
        eq(aiConfigVersion.userId, input.userId),
        eq(aiConfigVersion.chatbotId, input.chatbotId),
        eq(aiConfigVersion.settingKey, input.settingKey),
        eq(aiConfigVersion.status, 'published')
      )
    );

  const version = await getNextConfigVersion(tx, input);
  const [record] = await tx
    .insert(aiConfigVersion)
    .values({
      id: getUuid(),
      userId: input.userId,
      chatbotId: input.chatbotId,
      settingKey: input.settingKey,
      status: 'published',
      version,
      content: input.content,
      createdByType: input.createdByType,
      createdById: input.createdById ?? null,
      approvedByUserId: input.approvedByUserId,
      createdAt: now,
      publishedAt: now,
    })
    .returning();

  return record;
}

async function draftKnowledgeReply(params: {
  userId: string;
  chatbotId: string;
  message: string;
}): Promise<{ content: string; citations: Array<ReturnType<typeof buildCitation>> }> {
  const policy = await getPromptPersonaSettings({
    userId: params.userId,
    chatbotId: params.chatbotId,
  });
  const sources: AiKnowledgeSource[] = await db()
    .select()
    .from(aiKnowledgeSource)
    .where(
      and(
        eq(aiKnowledgeSource.userId, params.userId),
        eq(aiKnowledgeSource.chatbotId, params.chatbotId),
        eq(aiKnowledgeSource.status, 'ready'),
        isNull(aiKnowledgeSource.deletedAt)
      )
    )
    .orderBy(desc(aiKnowledgeSource.updatedAt))
    .limit(20);

  const normalizedMessage = params.message.toLowerCase();
  const matched =
    sources.find((source) => {
      const title = source.title.toLowerCase();
      return (
        source.type === 'custom_response' &&
        (normalizedMessage.includes(title) || title.includes(normalizedMessage))
      );
    });

  if (matched) {
    await db()
      .update(aiKnowledgeSource)
      .set({
        metadata: JSON.stringify({
          ...parseJsonObject(matched.metadata),
          hitCount: Number(parseJsonObject(matched.metadata).hitCount ?? 0) + 1,
          lastHitAt: new Date().toISOString(),
        }),
      })
      .where(eq(aiKnowledgeSource.id, matched.id));
    return {
      content: matched.content || 'This answer is configured but has no response content yet.',
      citations: [buildCitation(matched)],
    };
  }

  const keywords = normalizedMessage
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 2)
    .slice(0, 6);
  const chunks: Array<{ source: AiKnowledgeSource; chunk: AiKnowledgeChunk }> = keywords.length
    ? await db()
      .select({ chunk: aiKnowledgeChunk, source: aiKnowledgeSource })
      .from(aiKnowledgeChunk)
      .innerJoin(aiKnowledgeSource, eq(aiKnowledgeChunk.sourceId, aiKnowledgeSource.id))
      .where(and(
        eq(aiKnowledgeChunk.userId, params.userId),
        eq(aiKnowledgeChunk.chatbotId, params.chatbotId),
        eq(aiKnowledgeSource.status, 'ready'),
        isNull(aiKnowledgeSource.deletedAt),
        or(...keywords.map((word) => like(aiKnowledgeChunk.content, `%${word}%`)))
      ))
      .limit(6)
    : [];

  const best = chunks[0];
  const fallbackSource = sources.find((source) => source.content?.trim()) ?? sources[0];

  // No knowledge hit at all: still let the tool-calling agent answer when
  // the question names a part that exists in the chip catalog (FAE
  // selection/substitution questions), otherwise return the canned reply.
  if (!best && !fallbackSource && !(await questionMentionsCatalogPart(params.message))) {
    return {
      content: buildKnowledgeReply({
        title: '',
        excerpt: '',
        instructions: policy.instructions,
        persona: policy.persona,
      }),
      citations: [],
    };
  }

  const contexts = chunks.length
    ? chunks.map(({ source, chunk }) => ({ title: source.title, sourceUrl: source.sourceUrl, excerpt: chunk.content }))
    : fallbackSource
      ? [{
        title: fallbackSource.title,
        sourceUrl: fallbackSource.sourceUrl,
        excerpt: fallbackSource.content ?? fallbackSource.sourceUrl ?? 'configured knowledge source.',
      }]
      : [];
  // Unified platform billing: each AI-generated answer consumes the chatbot
  // owner's credits (ai_fae_cost_credits, default 1). Static custom-response
  // hits above stay free; billing failures never block the reply.
  const faeCost = await getAiFaeCostCredits();
  if (faeCost > 0 && (await getBalance(params.userId)) < faeCost) {
    return {
      content: buildKnowledgeReply({
        title: '',
        excerpt: '',
        instructions: policy.instructions,
        persona: policy.persona,
      }),
      citations: [],
    };
  }

  const content = await generateAnswerWithAgent({
    question: params.message,
    instructions: policy.instructions,
    persona: policy.persona,
    context: contexts,
  });

  if (faeCost > 0) {
    // Awaited on purpose: a fire-and-forget consume() opens a second write
    // transaction concurrently with the caller's reply transaction, which
    // deadlocks the synchronous local-sqlite driver (SQLITE_BUSY). Billing
    // failures still never block the reply.
    try {
      await consumeCredits({
        userId: params.userId,
        credits: faeCost,
        scene: 'ai_fae_answer',
        description: 'AI FAE generated answer',
      });
    } catch (error) {
      console.error('AI FAE credit consume failed:', error);
    }
  }
  const citedSources = chunks.length
    ? chunks.map(({ source }) => source)
    : fallbackSource
      ? [fallbackSource]
      : [];

  return {
    content,
    citations: citedSources
      .filter((source, index, items) => items.findIndex((item) => item.id === source.id) === index)
      .map((source) => buildCitation(source)),
  };
}

async function getAiFaeCostCredits(): Promise<number> {
  const configs = await getAllConfigs();
  const raw = Number.parseInt((configs.ai_fae_cost_credits as string) || '', 10);
  return Number.isFinite(raw) && raw >= 0 ? raw : 1;
}

async function getCount(table: any, where: any): Promise<number> {
  const [row] = await db().select({ count: count() }).from(table).where(where);
  return Number(row?.count ?? 0);
}

function statusForCount(countValue: number): AiSupportStatus {
  return countValue > 0 ? 'ready' : 'warning';
}

function readinessFrom(items: AiSupportChecklistItem[]): number {
  const score = items.reduce((sum, item) => {
    if (item.status === 'ready') return sum + 1;
    if (item.status === 'warning') return sum + 0.5;
    return sum;
  }, 0);
  return Math.round((score / items.length) * 100);
}

function nextMonthResetDate(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
}

export async function listChatbots(userId: string): Promise<AiChatbot[]> {
  return db()
    .select()
    .from(aiChatbot)
    .where(and(eq(aiChatbot.userId, userId), isNull(aiChatbot.deletedAt)))
    .orderBy(desc(aiChatbot.createdAt));
}

export async function getPublicChatbot(publicKey: string): Promise<Pick<
  AiChatbot,
  'id' | 'userId' | 'name' | 'description' | 'status' | 'installStatus' | 'publicKey' | 'allowedDomains'
> | null> {
  const [row] = await db()
    .select({
      id: aiChatbot.id,
      userId: aiChatbot.userId,
      name: aiChatbot.name,
      description: aiChatbot.description,
      status: aiChatbot.status,
      installStatus: aiChatbot.installStatus,
      publicKey: aiChatbot.publicKey,
      allowedDomains: aiChatbot.allowedDomains,
    })
    .from(aiChatbot)
    .where(
      and(
        eq(aiChatbot.publicKey, publicKey),
        eq(aiChatbot.status, 'active'),
        isNull(aiChatbot.deletedAt)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function getPublicWidgetConfig(publicKey: string) {
  const chatbot = await getPublicChatbot(publicKey);
  if (!chatbot) throw new Error('Chatbot not found');
  const humanSupport = await getHumanSupportSettings({
    userId: chatbot.userId,
    chatbotId: chatbot.id,
  });
  const appearance = await getWidgetAppearanceSettings({
    userId: chatbot.userId,
    chatbotId: chatbot.id,
  });

  return {
    chatbotId: chatbot.id,
    publicKey: chatbot.publicKey,
    name: chatbot.name,
    description: chatbot.description,
    installStatus: chatbot.installStatus,
    allowedDomains: parseJsonStringArray(chatbot.allowedDomains),
    humanSupportEnabled: humanSupport.enabled,
    humanSupport,
    appearance,
    leadCaptureEnabled: true,
  };
}

export async function getWidgetAppearanceSettings(params: {
  userId: string;
  chatbotId: string;
}): Promise<WidgetAppearanceSettings> {
  await assertOwnsChatbot(params.userId, params.chatbotId);
  const [latest] = await db()
    .select({ content: aiConfigVersion.content })
    .from(aiConfigVersion)
    .where(
      and(
        eq(aiConfigVersion.userId, params.userId),
        eq(aiConfigVersion.chatbotId, params.chatbotId),
        eq(aiConfigVersion.settingKey, WIDGET_APPEARANCE_SETTING_KEY),
        eq(aiConfigVersion.status, 'published')
      )
    )
    .orderBy(desc(aiConfigVersion.version))
    .limit(1);

  return latest ? parseWidgetAppearance(latest.content) : DEFAULT_WIDGET_APPEARANCE;
}

export async function updateWidgetAppearanceSettings(
  input: UpdateWidgetAppearanceInput
): Promise<WidgetAppearanceSettings> {
  await assertOwnsChatbot(input.userId, input.chatbotId);
  const current = await getWidgetAppearanceSettings({
    userId: input.userId,
    chatbotId: input.chatbotId,
  });
  const next = normalizeWidgetAppearance(input.settings, current);

  await db().transaction(async (tx: any) => {
    const record = await publishConfigVersion(tx, {
      userId: input.userId,
      chatbotId: input.chatbotId,
      settingKey: WIDGET_APPEARANCE_SETTING_KEY,
      content: JSON.stringify(next),
      createdByType: 'user',
      createdById: input.userId,
      approvedByUserId: input.userId,
    });

    await writeAudit(tx, {
      userId: input.userId,
      resourceType: 'ai_config_version',
      resourceId: record.id,
      action: 'widget.appearance.update',
      diff: next,
      metadata: {
        chatbotId: input.chatbotId,
        primaryColor: next.primaryColor,
      },
    });
  });

  return next;
}

export async function getLaunchOperationsSettings(params: {
  userId: string;
  chatbotId: string;
}): Promise<LaunchOperationsSettings> {
  await assertOwnsChatbot(params.userId, params.chatbotId);
  const [latest] = await db()
    .select({ content: aiConfigVersion.content })
    .from(aiConfigVersion)
    .where(
      and(
        eq(aiConfigVersion.userId, params.userId),
        eq(aiConfigVersion.chatbotId, params.chatbotId),
        eq(aiConfigVersion.settingKey, LAUNCH_OPERATIONS_SETTING_KEY),
        eq(aiConfigVersion.status, 'published')
      )
    )
    .orderBy(desc(aiConfigVersion.version))
    .limit(1);

  return latest ? parseLaunchOperations(latest.content) : DEFAULT_LAUNCH_OPERATIONS;
}

export async function updateLaunchOperationsSettings(
  input: UpdateLaunchOperationsInput
): Promise<LaunchOperationsSettings> {
  await assertOwnsChatbot(input.userId, input.chatbotId);
  const current = await getLaunchOperationsSettings({
    userId: input.userId,
    chatbotId: input.chatbotId,
  });
  const next = normalizeLaunchOperations(input.settings, current);

  await db().transaction(async (tx: any) => {
    const record = await publishConfigVersion(tx, {
      userId: input.userId,
      chatbotId: input.chatbotId,
      settingKey: LAUNCH_OPERATIONS_SETTING_KEY,
      content: JSON.stringify(next),
      createdByType: 'user',
      createdById: input.userId,
      approvedByUserId: input.userId,
    });

    await writeAudit(tx, {
      userId: input.userId,
      resourceType: 'ai_config_version',
      resourceId: record.id,
      action: 'launch.operations.update',
      diff: {
        ...next,
        errorAlertWebhookUrl: redactSecretUrl(next.errorAlertWebhookUrl),
      },
      metadata: {
        chatbotId: input.chatbotId,
        backupConfigured: next.backupConfigured,
        errorAlertsEnabled: next.errorAlertsEnabled,
        logRetentionDays: next.logRetentionDays,
      },
    });
  });

  return next;
}

async function getLatestConfigContent(params: {
  userId: string;
  chatbotId: string;
  settingKey: string;
}): Promise<string | null> {
  const [latest] = await db()
    .select({ content: aiConfigVersion.content })
    .from(aiConfigVersion)
    .where(
      and(
        eq(aiConfigVersion.userId, params.userId),
        eq(aiConfigVersion.chatbotId, params.chatbotId),
        eq(aiConfigVersion.settingKey, params.settingKey),
        eq(aiConfigVersion.status, 'published')
      )
    )
    .orderBy(desc(aiConfigVersion.version))
    .limit(1);

  return latest?.content ?? null;
}

export async function getWorkspaceSetting<T>(params: {
  userId: string;
  chatbotId: string;
  settingKey: string;
  fallback: T;
}): Promise<T> {
  await assertOwnsChatbot(params.userId, params.chatbotId);
  const content = await getLatestConfigContent(params);
  if (!content) return params.fallback;
  try {
    return JSON.parse(content) as T;
  } catch {
    return params.fallback;
  }
}

export async function updateWorkspaceSetting<T>(
  input: UpdateWorkspaceSettingInput<T>
): Promise<T> {
  await assertOwnsChatbot(input.userId, input.chatbotId);
  if (![
    CONVERSATION_STARTERS_SETTING_KEY,
    CONVERSATION_FOLLOWUPS_SETTING_KEY,
    LOCALIZATION_SETTING_KEY,
  ].includes(input.settingKey)) {
    throw new Error('Unsupported workspace setting');
  }

  const content = JSON.stringify(input.content);
  if (content.length > 24_000) throw new Error('Workspace setting is too large');

  await db().transaction(async (tx: any) => {
    const version = await publishConfigVersion(tx, {
      userId: input.userId,
      chatbotId: input.chatbotId,
      settingKey: input.settingKey,
      content,
      createdByType: 'user',
      createdById: input.userId,
      approvedByUserId: input.userId,
    });
    await writeAudit(tx, {
      userId: input.userId,
      resourceType: 'ai_config_version',
      resourceId: version.id,
      action: 'workspace_setting.publish',
      requiresApproval: Boolean(input.requiresApproval),
      metadata: { chatbotId: input.chatbotId, settingKey: input.settingKey },
    });
  });

  return input.content;
}

export async function getConversationButtons(params: {
  userId: string;
  chatbotId: string;
  kind: 'starters' | 'followups';
}): Promise<ConversationButton[]> {
  const settingKey = params.kind === 'starters'
    ? CONVERSATION_STARTERS_SETTING_KEY
    : CONVERSATION_FOLLOWUPS_SETTING_KEY;
  const value = await getWorkspaceSetting<unknown[]>({ ...params, settingKey, fallback: [] });
  return value.filter((item): item is ConversationButton => {
    if (!item || typeof item !== 'object') return false;
    const button = item as Partial<ConversationButton>;
    return typeof button.id === 'string' && typeof button.label === 'string' &&
      typeof button.value === 'string' && ['message', 'link', 'escalate'].includes(button.action ?? '') &&
      typeof button.enabled === 'boolean' && typeof button.locale === 'string';
  });
}

export async function updateConversationButtons(input: {
  userId: string;
  chatbotId: string;
  kind: 'starters' | 'followups';
  buttons: ConversationButton[];
}): Promise<ConversationButton[]> {
  if (input.buttons.length > 8) throw new Error('A chatbot can have at most 8 conversation buttons');
  const buttons = input.buttons.map((button) => {
    const label = button.label.trim().slice(0, 80);
    const value = button.value.trim().slice(0, 600);
    if (!label || !value || !['message', 'link', 'escalate'].includes(button.action)) {
      throw new Error('Conversation button is invalid');
    }
    if (button.action === 'link') normalizeOutboundHttpUrl(value, 'Conversation button URL');
    return { ...button, id: button.id || getUuid(), label, value, locale: button.locale || 'en' };
  });
  return updateWorkspaceSetting({
    userId: input.userId,
    chatbotId: input.chatbotId,
    settingKey: input.kind === 'starters'
      ? CONVERSATION_STARTERS_SETTING_KEY
      : CONVERSATION_FOLLOWUPS_SETTING_KEY,
    content: buttons,
    requiresApproval: true,
  });
}

export async function getLocalizationSettings(params: {
  userId: string;
  chatbotId: string;
}): Promise<LocalizationSettings> {
  return getWorkspaceSetting({ ...params, settingKey: LOCALIZATION_SETTING_KEY, fallback: DEFAULT_LOCALIZATION });
}

export async function updateLocalizationSettings(input: {
  userId: string;
  chatbotId: string;
  settings: LocalizationSettings;
}): Promise<LocalizationSettings> {
  const locale = input.settings.defaultLocale.trim().toLowerCase();
  if (!/^[a-z]{2,5}(?:-[a-z]{2,5})?$/.test(locale)) throw new Error('Default locale is invalid');
  const timezone = input.settings.timezone.trim();
  if (!timezone || timezone.length > 80) throw new Error('Timezone is invalid');
  const labels = Object.fromEntries(Object.entries(input.settings.labels ?? {})
    .filter(([key, value]) => key.length <= 80 && typeof value === 'string')
    .map(([key, value]) => [key, value.slice(0, 300)]));
  return updateWorkspaceSetting({
    userId: input.userId,
    chatbotId: input.chatbotId,
    settingKey: LOCALIZATION_SETTING_KEY,
    content: { defaultLocale: locale, timezone, autoDetectLocale: Boolean(input.settings.autoDetectLocale), labels },
    requiresApproval: true,
  });
}

export async function getPromptPersonaSettings(params: {
  userId: string;
  chatbotId: string;
}): Promise<PromptPersonaSettings> {
  await assertOwnsChatbot(params.userId, params.chatbotId);
  const [instructions, persona] = await Promise.all([
    getLatestConfigContent({
      userId: params.userId,
      chatbotId: params.chatbotId,
      settingKey: PROMPT_INSTRUCTIONS_SETTING_KEY,
    }),
    getLatestConfigContent({
      userId: params.userId,
      chatbotId: params.chatbotId,
      settingKey: PROMPT_PERSONA_SETTING_KEY,
    }),
  ]);

  return {
    instructions: instructions || DEFAULT_PROMPT_PERSONA.instructions,
    persona: persona || DEFAULT_PROMPT_PERSONA.persona,
  };
}

export async function updatePromptPersonaSettings(
  input: UpdatePromptPersonaInput
): Promise<PromptPersonaSettings> {
  await assertOwnsChatbot(input.userId, input.chatbotId);
  const current = await getPromptPersonaSettings({
    userId: input.userId,
    chatbotId: input.chatbotId,
  });
  const next = normalizePromptPersona(input.settings, current);

  await db().transaction(async (tx: any) => {
    const instructionsVersion = await publishConfigVersion(tx, {
      userId: input.userId,
      chatbotId: input.chatbotId,
      settingKey: PROMPT_INSTRUCTIONS_SETTING_KEY,
      content: next.instructions,
      createdByType: 'user',
      createdById: input.userId,
      approvedByUserId: input.userId,
    });
    const personaVersion = await publishConfigVersion(tx, {
      userId: input.userId,
      chatbotId: input.chatbotId,
      settingKey: PROMPT_PERSONA_SETTING_KEY,
      content: next.persona,
      createdByType: 'user',
      createdById: input.userId,
      approvedByUserId: input.userId,
    });

    await writeAudit(tx, {
      userId: input.userId,
      resourceType: 'ai_config_version',
      resourceId: instructionsVersion.id,
      action: 'prompt_persona.update',
      diff: {
        instructionsChanged: next.instructions !== current.instructions,
        personaChanged: next.persona !== current.persona,
      },
      metadata: {
        chatbotId: input.chatbotId,
        instructionsVersionId: instructionsVersion.id,
        personaVersionId: personaVersion.id,
      },
    });
  });

  return next;
}

export async function getHumanSupportSettings(params: {
  userId: string;
  chatbotId: string;
}): Promise<HumanSupportSettings> {
  await assertOwnsChatbot(params.userId, params.chatbotId);
  const [latest] = await db()
    .select({ content: aiConfigVersion.content })
    .from(aiConfigVersion)
    .where(
      and(
        eq(aiConfigVersion.userId, params.userId),
        eq(aiConfigVersion.chatbotId, params.chatbotId),
        eq(aiConfigVersion.settingKey, HUMAN_SUPPORT_SETTING_KEY),
        eq(aiConfigVersion.status, 'published')
      )
    )
    .orderBy(desc(aiConfigVersion.version))
    .limit(1);

  return latest ? parseHumanSupportSettings(latest.content) : DEFAULT_HUMAN_SUPPORT_SETTINGS;
}

export async function updateHumanSupportSettings(
  input: UpdateHumanSupportSettingsInput
): Promise<HumanSupportSettings> {
  await assertOwnsChatbot(input.userId, input.chatbotId);
  const current = await getHumanSupportSettings({
    userId: input.userId,
    chatbotId: input.chatbotId,
  });
  const next = normalizeHumanSupportSettings(input.settings, current);

  await db().transaction(async (tx: any) => {
    const record = await publishConfigVersion(tx, {
      userId: input.userId,
      chatbotId: input.chatbotId,
      settingKey: HUMAN_SUPPORT_SETTING_KEY,
      content: JSON.stringify(next),
      createdByType: 'user',
      createdById: input.userId,
      approvedByUserId: input.userId,
    });

    await writeAudit(tx, {
      userId: input.userId,
      resourceType: 'ai_config_version',
      resourceId: record.id,
      action: 'human_support.settings.update',
      diff: {
        ...next,
        notificationEmail: redactPiiText(next.notificationEmail),
        notificationWebhookUrl: redactSecretUrl(next.notificationWebhookUrl),
      },
      metadata: {
        chatbotId: input.chatbotId,
        notificationsEnabled: next.notificationsEnabled,
        notificationEmail: redactPiiText(next.notificationEmail),
        notificationWebhookConfigured: Boolean(next.notificationWebhookUrl),
      },
    });
  });

  return next;
}

export async function createChatbot(input: CreateChatbotInput): Promise<AiChatbot> {
  const name = input.name.trim();
  if (!name) throw new Error('Chatbot name is required');
  if (name.length > 120) throw new Error('Chatbot name is too long');

  const now = new Date();
  const publicKey = `cb_${getNonceStr(24)}`;

  return db().transaction(async (tx: any) => {
    const [row] = await tx
      .insert(aiChatbot)
      .values({
        id: getUuid(),
        userId: input.userId,
        name,
        description: input.description?.trim() ?? '',
        status: 'draft',
        installStatus: 'not_installed',
        publicKey,
        allowedDomains: JSON.stringify(input.allowedDomains ?? []),
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await writeAudit(tx, {
      userId: input.userId,
      resourceType: 'ai_chatbot',
      resourceId: row.id,
      action: 'chatbot.create',
      metadata: { name },
    });

    return row;
  });
}

export async function updateChatbot(input: UpdateChatbotInput): Promise<AiChatbot> {
  const [existing] = await db()
    .select()
    .from(aiChatbot)
    .where(
      and(
        eq(aiChatbot.id, input.id),
        eq(aiChatbot.userId, input.userId),
        isNull(aiChatbot.deletedAt)
      )
    )
    .limit(1);
  if (!existing) throw new Error('Chatbot not found');

  const updates: Partial<typeof aiChatbot.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error('Chatbot name is required');
    if (name.length > 120) throw new Error('Chatbot name is too long');
    updates.name = name;
  }
  if (input.description !== undefined) updates.description = input.description.trim();
  if (input.status !== undefined) {
    assertOneOf(input.status, CHATBOT_STATUSES, 'chatbot status');
    updates.status = input.status;
  }
  if (input.installStatus !== undefined) {
    assertOneOf(input.installStatus, CHATBOT_INSTALL_STATUSES, 'chatbot install status');
    updates.installStatus = input.installStatus;
  }
  if (input.allowedDomains !== undefined) {
    updates.allowedDomains = JSON.stringify(
      input.allowedDomains.map((domain) => domain.trim()).filter(Boolean)
    );
  }

  return db().transaction(async (tx: any) => {
    const [row] = await tx
      .update(aiChatbot)
      .set(updates)
      .where(eq(aiChatbot.id, input.id))
      .returning();

    await writeAudit(tx, {
      userId: input.userId,
      resourceType: 'ai_chatbot',
      resourceId: input.id,
      action: input.status === 'active' ? 'chatbot.activate' : 'chatbot.update',
      requiresApproval: input.status === 'active',
      status: input.status === 'active' ? 'pending_approval' : 'recorded',
      diff: updates,
      metadata: { previousStatus: existing.status },
    });

    return row;
  });
}

export async function checkChatbotInstallation(
  input: CheckChatbotInstallationInput
): Promise<CheckChatbotInstallationResult> {
  const targetUrl = normalizePublicUrl(input.url);
  const normalizedUrl = targetUrl.toString();
  const [chatbot] = await db()
    .select()
    .from(aiChatbot)
    .where(
      and(
        eq(aiChatbot.id, input.chatbotId),
        eq(aiChatbot.userId, input.userId),
        isNull(aiChatbot.deletedAt)
      )
    )
    .limit(1);
  if (!chatbot) throw new Error('Chatbot not found');

  const checkedAt = new Date();
  let result: CheckChatbotInstallationResult;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const response = await fetchInstallCheckPage(targetUrl, controller.signal)
      .finally(() => clearTimeout(timeout));

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    const canScanBody = contentType.includes('text/html') || contentType.includes('application/xhtml+xml') || !contentType;
    const html = canScanBody ? await readLimitedResponseText(response) : '';
    const detection = detectWidgetInstall(html, chatbot);
    const installStatus: ChatbotInstallStatus = detection.installed ? 'installed' : 'not_installed';

    result = {
      url: input.url.trim(),
      normalizedUrl,
      installed: detection.installed,
      installStatus,
      statusCode: response.status,
      reason: detection.installed
        ? 'Widget script and chatbot public key were detected.'
        : canScanBody
          ? 'Widget script was not detected on the checked page.'
          : 'Checked URL did not return HTML.',
      detectedPublicKey: detection.detectedPublicKey,
      checkedAt: checkedAt.toISOString(),
    };
  } catch (error: any) {
    result = {
      url: input.url.trim(),
      normalizedUrl,
      installed: false,
      installStatus: 'error',
      statusCode: null,
      reason: error?.name === 'AbortError' ? 'Installation check timed out.' : error?.message || 'Installation check failed.',
      detectedPublicKey: null,
      checkedAt: checkedAt.toISOString(),
    };
  }

  await db().transaction(async (tx: any) => {
    await tx
      .update(aiChatbot)
      .set({
        installStatus: result.installStatus,
        updatedAt: checkedAt,
      })
      .where(eq(aiChatbot.id, input.chatbotId));

    await writeAudit(tx, {
      userId: input.userId,
      resourceType: 'ai_chatbot',
      resourceId: input.chatbotId,
      action: 'chatbot.install_check',
      diff: {
        installStatus: result.installStatus,
        installed: result.installed,
        statusCode: result.statusCode,
      },
      metadata: {
        url: result.normalizedUrl,
        detectedPublicKey: result.detectedPublicKey,
        reason: result.reason,
      },
    });
  });

  return result;
}

export async function listKnowledgeSources(params: {
  userId: string;
  chatbotId?: string;
  type?: KnowledgeSourceType;
}): Promise<AiKnowledgeSource[]> {
  const conditions = [eq(aiKnowledgeSource.userId, params.userId), isNull(aiKnowledgeSource.deletedAt)];
  if (params.chatbotId) conditions.push(eq(aiKnowledgeSource.chatbotId, params.chatbotId));
  if (params.type) conditions.push(eq(aiKnowledgeSource.type, params.type));

  return db()
    .select()
    .from(aiKnowledgeSource)
    .where(and(...conditions))
    .orderBy(desc(aiKnowledgeSource.updatedAt));
}

export async function listKnowledgeSyncJobs(params: {
  userId: string;
  chatbotId?: string;
}): Promise<AiKnowledgeSyncJob[]> {
  const sources = await listKnowledgeSources(params);
  if (sources.length === 0) return [];
  const jobConditions = [eq(aiKnowledgeSyncJob.userId, params.userId)];
  if (params.chatbotId) jobConditions.push(eq(aiKnowledgeSyncJob.chatbotId, params.chatbotId));
  const jobs = (await db()
    .select()
    .from(aiKnowledgeSyncJob)
    .where(and(...jobConditions))) as DbAiKnowledgeSyncJob[];
  const bySource = new Map(jobs.map((job) => [job.sourceId, job]));
  return sources.map((source) => syncJobView(source, bySource.get(source.id)));
}

export async function runKnowledgeSyncJob(params: {
  userId: string;
  sourceId: string;
  content?: string;
  error?: string;
}): Promise<AiKnowledgeSyncJob> {
  const [existing] = await db()
    .select()
    .from(aiKnowledgeSource)
    .where(
      and(
        eq(aiKnowledgeSource.id, params.sourceId),
        eq(aiKnowledgeSource.userId, params.userId),
        isNull(aiKnowledgeSource.deletedAt)
      )
    )
    .limit(1);
  if (!existing) throw new Error('Knowledge source not found');
  await assertOwnsChatbot(params.userId, existing.chatbotId);

  const now = new Date();
  const resolvedContent = params.content?.trim() ?? existing.content?.trim() ?? '';
  const syncError = params.error?.trim() || (!resolvedContent ? 'Knowledge source needs content before syncing.' : null);

  return db().transaction(async (tx: any) => {
    const [previousJob] = await tx
      .select()
      .from(aiKnowledgeSyncJob)
      .where(eq(aiKnowledgeSyncJob.sourceId, existing.id))
      .limit(1);
    const attempts = Number(previousJob?.attempts ?? 0) + 1;
    const status = syncError ? 'failed' : 'synced';
    const intervalMinutes = Number(previousJob?.intervalMinutes ?? 1440);
    const nextRunAt = new Date(now.getTime() + Math.max(intervalMinutes, 15) * 60_000);
    const [row] = await tx
      .update(aiKnowledgeSource)
      .set({
        status: syncError ? 'needs_review' : 'ready',
        content: resolvedContent || existing.content,
        lastSyncedAt: syncError ? existing.lastSyncedAt : now,
        updatedAt: now,
      })
      .where(eq(aiKnowledgeSource.id, params.sourceId))
      .returning();

    if (!syncError) await replaceKnowledgeChunks(tx, row, resolvedContent);

    const jobValues = {
      userId: existing.userId,
      chatbotId: existing.chatbotId,
      sourceId: existing.id,
      enabled: previousJob?.enabled ?? true,
      intervalMinutes: Math.max(intervalMinutes, 15),
      status,
      attempts,
      lastError: syncError,
      lastRunAt: now,
      nextRunAt,
      updatedAt: now,
    };
    const job = previousJob
      ? (await tx.update(aiKnowledgeSyncJob).set(jobValues).where(eq(aiKnowledgeSyncJob.id, previousJob.id)).returning())[0]
      : (await tx.insert(aiKnowledgeSyncJob).values({ id: getUuid(), ...jobValues, createdAt: now }).returning())[0];

    await writeAudit(tx, {
      userId: params.userId,
      resourceType: 'ai_knowledge_source',
      resourceId: params.sourceId,
      action: syncError ? 'knowledge.sync.failed' : 'knowledge.sync',
      status: syncError ? 'failed' : 'recorded',
      metadata: {
        chatbotId: existing.chatbotId,
        type: existing.type,
        attempts,
        lastError: syncError,
      },
    });

    return syncJobView(row, job);
  });
}

export async function runConfiguredKnowledgeSync(params: {
  userId: string;
  sourceId: string;
}): Promise<AiKnowledgeSyncJob> {
  const [source] = await db().select().from(aiKnowledgeSource).where(and(
    eq(aiKnowledgeSource.id, params.sourceId),
    eq(aiKnowledgeSource.userId, params.userId),
    isNull(aiKnowledgeSource.deletedAt)
  )).limit(1);
  if (!source) throw new Error('Knowledge source not found');
  if (source.type !== 'website_link' || !source.sourceUrl) {
    return runKnowledgeSyncJob(params);
  }

  try {
    const fetched = await fetchWebsiteKnowledge({
      url: source.sourceUrl,
      metadata: parseJsonObject(source.metadata),
    });
    return runKnowledgeSyncJob({
      userId: params.userId,
      sourceId: params.sourceId,
      content: fetched.content,
    });
  } catch (error) {
    return runKnowledgeSyncJob({
      userId: params.userId,
      sourceId: params.sourceId,
      error: error instanceof Error ? error.message : 'Knowledge provider sync failed',
    });
  }
}

export async function updateKnowledgeSyncJob(params: {
  userId: string;
  sourceId: string;
  enabled?: boolean;
  intervalMinutes?: number;
}): Promise<AiKnowledgeSyncJob> {
  const [source] = await db().select().from(aiKnowledgeSource).where(and(
    eq(aiKnowledgeSource.id, params.sourceId),
    eq(aiKnowledgeSource.userId, params.userId),
    isNull(aiKnowledgeSource.deletedAt)
  )).limit(1);
  if (!source) throw new Error('Knowledge source not found');
  const [existing] = await db().select().from(aiKnowledgeSyncJob)
    .where(eq(aiKnowledgeSyncJob.sourceId, source.id)).limit(1);
  const intervalMinutes = params.intervalMinutes === undefined
    ? Number(existing?.intervalMinutes ?? 1440)
    : Math.min(Math.max(Math.floor(params.intervalMinutes), 15), 43_200);
  const now = new Date();
  const values = {
    enabled: params.enabled ?? existing?.enabled ?? true,
    intervalMinutes,
    nextRunAt: new Date(now.getTime() + intervalMinutes * 60_000),
    updatedAt: now,
  };
  const job = existing
    ? (await db().update(aiKnowledgeSyncJob).set(values).where(eq(aiKnowledgeSyncJob.id, existing.id)).returning())[0]
    : (await db().insert(aiKnowledgeSyncJob).values({
        id: getUuid(), userId: source.userId, chatbotId: source.chatbotId, sourceId: source.id,
        status: 'pending', attempts: 0, lastError: null, lastRunAt: null, createdAt: now, ...values,
      }).returning())[0];
  return syncJobView(source, job);
}

export async function listConversations(params: {
  userId: string;
  chatbotId?: string;
  status?: string;
  feedback?: string;
  search?: string;
}): Promise<AiConversation[]> {
  const conditions = [eq(aiConversation.userId, params.userId)];
  if (params.chatbotId) conditions.push(eq(aiConversation.chatbotId, params.chatbotId));
  if (params.status) conditions.push(eq(aiConversation.status, params.status));
  if (params.feedback) conditions.push(eq(aiConversation.feedback, params.feedback));
  if (params.search?.trim()) {
    const query = `%${params.search.trim().slice(0, 120)}%`;
    conditions.push(or(
      like(aiConversation.lastMessage, query),
      like(aiConversation.contactName, query),
      like(aiConversation.contactEmail, query)
    )!);
  }

  const rows = await db()
    .select()
    .from(aiConversation)
    .where(and(...conditions))
    .orderBy(desc(aiConversation.updatedAt))
    .limit(50);
  return rows.map(redactConversation);
}

export async function getConversationWithMessages(params: {
  userId: string;
  conversationId: string;
}): Promise<AiConversationWithMessages> {
  const [conversation] = await db()
    .select()
    .from(aiConversation)
    .where(and(eq(aiConversation.id, params.conversationId), eq(aiConversation.userId, params.userId)))
    .limit(1);
  if (!conversation) throw new Error('Conversation not found');

  const messages = await db()
    .select()
    .from(aiConversationMessage)
    .where(eq(aiConversationMessage.conversationId, params.conversationId))
    .orderBy(asc(aiConversationMessage.createdAt));

  return {
    ...redactConversation(conversation),
    messages: messages.map(redactConversationMessage),
  };
}

export async function updateConversation(params: {
  userId: string;
  id: string;
  status?: 'open' | 'resolved';
  feedback?: 'positive' | 'negative' | null;
  tags?: string[];
}): Promise<AiConversation> {
  const [existing] = await db().select().from(aiConversation).where(and(
    eq(aiConversation.id, params.id),
    eq(aiConversation.userId, params.userId)
  )).limit(1);
  if (!existing) throw new Error('Conversation not found');
  const [conversation] = await db().transaction(async (tx: any) => {
    const [row] = await tx.update(aiConversation).set({
      status: params.status ?? existing.status,
      feedback: params.feedback === undefined ? existing.feedback : params.feedback,
      updatedAt: new Date(),
    }).where(eq(aiConversation.id, existing.id)).returning();
    if (params.tags) {
      await tx.delete(aiConversationTag).where(eq(aiConversationTag.conversationId, existing.id));
      const labels = [...new Set(params.tags.map((tag) => tag.trim().slice(0, 50)).filter(Boolean))].slice(0, 12);
      if (labels.length) await tx.insert(aiConversationTag).values(labels.map((label) => ({
        id: getUuid(), userId: params.userId, conversationId: existing.id, label, createdAt: new Date(),
      })));
    }
    await writeAudit(tx, {
      userId: params.userId,
      resourceType: 'ai_conversation',
      resourceId: existing.id,
      action: 'conversation.update',
      diff: { status: params.status, feedback: params.feedback, tags: params.tags },
    });
    return [row];
  });
  return redactConversation(conversation);
}

export async function createKnowledgeGap(params: {
  userId: string;
  chatbotId: string;
  conversationId?: string;
  question: string;
}) {
  await assertOwnsChatbot(params.userId, params.chatbotId);
  const question = params.question.trim().slice(0, 2000);
  if (!question) throw new Error('Knowledge gap question is required');
  const [row] = await db().transaction(async (tx: any) => {
    const [record] = await tx.insert(aiKnowledgeGap).values({
      id: getUuid(), userId: params.userId, chatbotId: params.chatbotId,
      conversationId: params.conversationId ?? null, question, status: 'open', createdAt: new Date(), resolvedAt: null,
    }).returning();
    await writeAudit(tx, {
      userId: params.userId, resourceType: 'ai_knowledge_gap', resourceId: record.id,
      action: 'knowledge_gap.create', metadata: { chatbotId: params.chatbotId, conversationId: params.conversationId },
    });
    return [record];
  });
  return row;
}

export async function listKnowledgeGaps(params: { userId: string; chatbotId?: string }) {
  const conditions = [eq(aiKnowledgeGap.userId, params.userId)];
  if (params.chatbotId) conditions.push(eq(aiKnowledgeGap.chatbotId, params.chatbotId));
  return db().select().from(aiKnowledgeGap).where(and(...conditions)).orderBy(desc(aiKnowledgeGap.createdAt));
}

export async function createPublicConversationMessage(
  input: PublicConversationMessageInput
): Promise<PublicConversationMessageResult> {
  const chatbot = await getPublicChatbot(input.publicKey);
  if (!chatbot) throw new Error('Chatbot not found');

  const message = input.message.trim();
  if (!message) throw new Error('Message is required');
  if (message.length > 4000) throw new Error('Message is too long');

  const existingConversation = input.conversationId
    ? await db()
        .select()
        .from(aiConversation)
        .where(
          and(
            eq(aiConversation.id, input.conversationId),
            eq(aiConversation.userId, chatbot.userId),
            eq(aiConversation.chatbotId, chatbot.id)
          )
        )
        .limit(1)
    : [];

  const reply = await draftKnowledgeReply({
    userId: chatbot.userId,
    chatbotId: chatbot.id,
    message,
  });

  const now = new Date();

  return db().transaction(async (tx: any) => {
    const conversation =
      existingConversation[0] ??
      (
        await tx
          .insert(aiConversation)
          .values({
            id: getUuid(),
            userId: chatbot.userId,
            chatbotId: chatbot.id,
            status: 'open',
            sourceUrl: input.sourceUrl?.trim() || null,
            visitorId: input.visitorId?.trim() || null,
            contactName: input.contactName?.trim() || null,
            contactEmail: input.contactEmail?.trim() || null,
            lastMessage: '',
            messageCount: 0,
            metadata: JSON.stringify(input.metadata ?? {}),
            createdAt: now,
            updatedAt: now,
          })
          .returning()
      )[0];

    const [userMessage] = await tx
      .insert(aiConversationMessage)
      .values({
        id: getUuid(),
        userId: chatbot.userId,
        chatbotId: chatbot.id,
        conversationId: conversation.id,
        role: 'user',
        content: message,
        citations: JSON.stringify([]),
        metadata: JSON.stringify({
          sourceUrl: input.sourceUrl,
          visitorId: input.visitorId,
        }),
        createdAt: now,
      })
      .returning();

    const [assistantMessage] = await tx
      .insert(aiConversationMessage)
      .values({
        id: getUuid(),
        userId: chatbot.userId,
        chatbotId: chatbot.id,
        conversationId: conversation.id,
        role: 'assistant',
        content: reply.content,
        citations: JSON.stringify(reply.citations),
        metadata: JSON.stringify({ mode: 'knowledge_draft' }),
        createdAt: now,
      })
      .returning();

    const metadata = {
      ...parseJsonObject(conversation.metadata),
      ...(input.metadata ?? {}),
    };

    const [updatedConversation] = await tx
      .update(aiConversation)
      .set({
        status: 'open',
        sourceUrl: input.sourceUrl?.trim() || conversation.sourceUrl,
        visitorId: input.visitorId?.trim() || conversation.visitorId,
        contactName: input.contactName?.trim() || conversation.contactName,
        contactEmail: input.contactEmail?.trim() || conversation.contactEmail,
        lastMessage: message,
        messageCount: Number(conversation.messageCount ?? 0) + 2,
        metadata: JSON.stringify(metadata),
        updatedAt: now,
      })
      .where(eq(aiConversation.id, conversation.id))
      .returning();

    await writeAudit(tx, {
      userId: chatbot.userId,
      actorType: 'agent',
      actorId: chatbot.publicKey,
      resourceType: 'ai_conversation',
      resourceId: conversation.id,
      action: 'conversation.reply',
      metadata: {
        source: 'public_widget',
        citationCount: reply.citations.length,
      },
    });

    return {
      conversation: updatedConversation,
      userMessage,
      assistantMessage,
    };
  });
}

export async function beginPublicConversationMessage(
  input: PublicConversationMessageInput
): Promise<{ chatbot: NonNullable<Awaited<ReturnType<typeof getPublicChatbot>>>; conversation: AiConversation; userMessage: AiConversationMessage }> {
  const chatbot = await getPublicChatbot(input.publicKey);
  if (!chatbot) throw new Error('Chatbot not found');
  const message = input.message.trim();
  if (!message) throw new Error('Message is required');
  if (message.length > 4000) throw new Error('Message is too long');

  const existingConversation = input.conversationId
    ? await db().select().from(aiConversation).where(and(
        eq(aiConversation.id, input.conversationId),
        eq(aiConversation.userId, chatbot.userId),
        eq(aiConversation.chatbotId, chatbot.id)
      )).limit(1)
    : [];
  const now = new Date();
  return db().transaction(async (tx: any) => {
    const conversation = existingConversation[0] ?? (await tx.insert(aiConversation).values({
      id: input.conversationId ?? getUuid(), userId: chatbot.userId, chatbotId: chatbot.id, status: 'open',
      sourceUrl: input.sourceUrl?.trim() || null, visitorId: input.visitorId?.trim() || null,
      contactName: input.contactName?.trim() || null, contactEmail: input.contactEmail?.trim() || null,
      lastMessage: '', messageCount: 0, metadata: JSON.stringify(input.metadata ?? {}), createdAt: now, updatedAt: now,
    }).returning())[0];
    const [userMessage] = await tx.insert(aiConversationMessage).values({
      id: getUuid(), userId: chatbot.userId, chatbotId: chatbot.id, conversationId: conversation.id,
      role: 'user', content: message, citations: JSON.stringify([]),
      metadata: JSON.stringify({ sourceUrl: input.sourceUrl, visitorId: input.visitorId }), createdAt: now,
    }).returning();
    const metadata = { ...parseJsonObject(conversation.metadata), ...(input.metadata ?? {}) };
    const [updatedConversation] = await tx.update(aiConversation).set({
      status: 'open', sourceUrl: input.sourceUrl?.trim() || conversation.sourceUrl,
      visitorId: input.visitorId?.trim() || conversation.visitorId,
      contactName: input.contactName?.trim() || conversation.contactName,
      contactEmail: input.contactEmail?.trim() || conversation.contactEmail,
      lastMessage: message, messageCount: Number(conversation.messageCount ?? 0) + 1,
      metadata: JSON.stringify(metadata), updatedAt: now,
    }).where(eq(aiConversation.id, conversation.id)).returning();
    await writeAudit(tx, {
      userId: chatbot.userId, actorType: 'agent', actorId: input.visitorId?.trim() || chatbot.publicKey,
      resourceType: 'ai_conversation', resourceId: conversation.id, action: 'conversation.message_received',
      metadata: { source: 'public_widget' },
    });
    return { chatbot, conversation: updatedConversation, userMessage };
  });
}

export async function answerPublicConversationMessage(input: {
  publicKey: string;
  conversationId: string;
  userMessageId: string;
}): Promise<{ conversation: AiConversation; assistantMessage: AiConversationMessage }> {
  const chatbot = await getPublicChatbot(input.publicKey);
  if (!chatbot) throw new Error('Chatbot not found');
  const [conversation] = await db().select().from(aiConversation).where(and(
    eq(aiConversation.id, input.conversationId), eq(aiConversation.userId, chatbot.userId), eq(aiConversation.chatbotId, chatbot.id)
  )).limit(1);
  if (!conversation) throw new Error('Conversation not found');
  const [userMessage] = await db().select().from(aiConversationMessage).where(and(
    eq(aiConversationMessage.id, input.userMessageId), eq(aiConversationMessage.conversationId, conversation.id),
    eq(aiConversationMessage.role, 'user')
  )).limit(1);
  if (!userMessage) throw new Error('Conversation message not found');
  const reply = await draftKnowledgeReply({ userId: chatbot.userId, chatbotId: chatbot.id, message: userMessage.content });
  const now = new Date();
  return db().transaction(async (tx: any) => {
    const [assistantMessage] = await tx.insert(aiConversationMessage).values({
      id: getUuid(), userId: chatbot.userId, chatbotId: chatbot.id, conversationId: conversation.id,
      role: 'assistant', content: reply.content, citations: JSON.stringify(reply.citations),
      metadata: JSON.stringify({ mode: 'knowledge_draft' }), createdAt: now,
    }).returning();
    const [updatedConversation] = await tx.update(aiConversation).set({
      status: 'open', messageCount: Number(conversation.messageCount ?? 0) + 1, updatedAt: now,
    }).where(eq(aiConversation.id, conversation.id)).returning();
    await writeAudit(tx, {
      userId: chatbot.userId, actorType: 'agent', actorId: 'agent-task-worker',
      resourceType: 'ai_conversation', resourceId: conversation.id, action: 'conversation.reply',
      metadata: { source: 'agent_task', citationCount: reply.citations.length },
    });
    return { conversation: updatedConversation, assistantMessage };
  });
}

export async function getPublicConversationMessages(input: { publicKey: string; conversationId: string }) {
  const chatbot = await getPublicChatbot(input.publicKey);
  if (!chatbot) throw new Error('Chatbot not found');
  const [conversation] = await db().select({ id: aiConversation.id }).from(aiConversation).where(and(
    eq(aiConversation.id, input.conversationId), eq(aiConversation.userId, chatbot.userId), eq(aiConversation.chatbotId, chatbot.id)
  )).limit(1);
  if (!conversation) throw new Error('Conversation not found');
  return db().select().from(aiConversationMessage).where(eq(aiConversationMessage.conversationId, conversation.id)).orderBy(asc(aiConversationMessage.createdAt));
}

export async function createSupportReply(input: {
  userId: string;
  escalationId: string;
  content: string;
}): Promise<AiConversationMessage> {
  const message = input.content.trim();
  if (!message || message.length > 4000) throw new Error('Support reply must be between 1 and 4000 characters');
  const [escalation] = await db().select().from(aiHumanEscalation).where(and(
    eq(aiHumanEscalation.id, input.escalationId),
    eq(aiHumanEscalation.userId, input.userId)
  )).limit(1);
  if (!escalation?.conversationId) throw new Error('Escalation has no conversation');
  const [conversation] = await db().select().from(aiConversation).where(and(
    eq(aiConversation.id, escalation.conversationId),
    eq(aiConversation.userId, input.userId),
    eq(aiConversation.chatbotId, escalation.chatbotId)
  )).limit(1);
  if (!conversation) throw new Error('Conversation not found');
  const now = new Date();
  return db().transaction(async (tx: any) => {
    const [reply] = await tx.insert(aiConversationMessage).values({
      id: getUuid(), userId: input.userId, chatbotId: escalation.chatbotId,
      conversationId: conversation.id, role: 'support', content: message,
      citations: JSON.stringify([]), feedback: null,
      metadata: JSON.stringify({ escalationId: escalation.id, delivery: 'widget' }), createdAt: now,
    }).returning();
    await tx.update(aiHumanEscalation).set({
      status: 'assigned', assigneeUserId: input.userId, updatedAt: now,
    }).where(eq(aiHumanEscalation.id, escalation.id));
    await writeAudit(tx, {
      userId: input.userId, resourceType: 'ai_human_escalation', resourceId: escalation.id,
      action: 'support_reply.send', metadata: { conversationId: conversation.id, delivery: 'widget' },
    });
    return reply;
  });
}

export async function listPublicSupportReplies(input: {
  publicKey: string;
  conversationId: string;
}): Promise<AiConversationMessage[]> {
  const chatbot = await getPublicChatbot(input.publicKey);
  if (!chatbot) throw new Error('Chatbot not found');
  const [conversation] = await db().select({ id: aiConversation.id }).from(aiConversation).where(and(
    eq(aiConversation.id, input.conversationId),
    eq(aiConversation.userId, chatbot.userId),
    eq(aiConversation.chatbotId, chatbot.id)
  )).limit(1);
  if (!conversation) throw new Error('Conversation not found');
  return db().select().from(aiConversationMessage).where(and(
    eq(aiConversationMessage.conversationId, conversation.id),
    eq(aiConversationMessage.role, 'support')
  )).orderBy(asc(aiConversationMessage.createdAt));
}

export async function createKnowledgeSource(
  input: CreateKnowledgeSourceInput
): Promise<AiKnowledgeSource> {
  assertKnowledgeType(input.type);
  await assertOwnsChatbot(input.userId, input.chatbotId);

  const title = input.title.trim();
  if (!title) throw new Error('Knowledge source title is required');
  if (title.length > 180) throw new Error('Knowledge source title is too long');
  const now = new Date();

  return db().transaction(async (tx: any) => {
    const [row] = await tx
      .insert(aiKnowledgeSource)
      .values({
        id: getUuid(),
        userId: input.userId,
        chatbotId: input.chatbotId,
        type: input.type,
        title,
        status: 'draft',
        content: input.content?.trim() || null,
        sourceUrl: input.sourceUrl?.trim() || null,
        metadata: JSON.stringify(input.metadata ?? {}),
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await writeAudit(tx, {
      userId: input.userId,
      resourceType: 'ai_knowledge_source',
      resourceId: row.id,
      action: 'knowledge.create',
      metadata: { chatbotId: input.chatbotId, type: input.type, title },
    });

    return row;
  });
}

export async function updateKnowledgeSource(
  input: UpdateKnowledgeSourceInput
): Promise<AiKnowledgeSource> {
  const [existing] = await db()
    .select()
    .from(aiKnowledgeSource)
    .where(
      and(
        eq(aiKnowledgeSource.id, input.id),
        eq(aiKnowledgeSource.userId, input.userId),
        isNull(aiKnowledgeSource.deletedAt)
      )
    )
    .limit(1);
  if (!existing) throw new Error('Knowledge source not found');

  const updates: Partial<typeof aiKnowledgeSource.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) throw new Error('Knowledge source title is required');
    updates.title = title;
  }
  if (input.content !== undefined) updates.content = input.content.trim() || null;
  if (input.sourceUrl !== undefined) updates.sourceUrl = input.sourceUrl.trim() || null;
  if (input.status !== undefined) {
    assertOneOf(input.status, KNOWLEDGE_STATUSES, 'knowledge source status');
    updates.status = input.status;
  }
  if (input.metadata !== undefined) updates.metadata = JSON.stringify(input.metadata);

  return db().transaction(async (tx: any) => {
    const [row] = await tx
      .update(aiKnowledgeSource)
      .set(updates)
      .where(eq(aiKnowledgeSource.id, input.id))
      .returning();

    await writeAudit(tx, {
      userId: input.userId,
      resourceType: 'ai_knowledge_source',
      resourceId: input.id,
      action: input.status === 'ready' ? 'knowledge.publish' : 'knowledge.update',
      requiresApproval: input.status === 'ready',
      status: input.status === 'ready' ? 'pending_approval' : 'recorded',
      diff: updates,
      metadata: { previousStatus: existing.status },
    });

    return row;
  });
}

export async function archiveKnowledgeSource(params: {
  userId: string;
  id: string;
}): Promise<void> {
  const now = new Date();
  await db().transaction(async (tx: any) => {
    const [row] = await tx
      .update(aiKnowledgeSource)
      .set({ status: 'archived', deletedAt: now, updatedAt: now })
      .where(and(eq(aiKnowledgeSource.id, params.id), eq(aiKnowledgeSource.userId, params.userId)))
      .returning();
    if (!row) throw new Error('Knowledge source not found');

    await writeAudit(tx, {
      userId: params.userId,
      resourceType: 'ai_knowledge_source',
      resourceId: params.id,
      action: 'knowledge.archive',
      requiresApproval: true,
      status: 'pending_approval',
    });
  });
}

export async function listLeads(params: {
  userId: string;
  chatbotId?: string;
  status?: string;
}): Promise<AiLead[]> {
  const conditions = [eq(aiLead.userId, params.userId)];
  if (params.chatbotId) conditions.push(eq(aiLead.chatbotId, params.chatbotId));
  if (params.status) conditions.push(eq(aiLead.status, params.status));

  const rows = await db()
    .select()
    .from(aiLead)
    .where(and(...conditions))
    .orderBy(desc(aiLead.createdAt));
  return rows.map(redactLead);
}

export async function createLead(input: CreateLeadInput): Promise<AiLead> {
  await assertOwnsChatbot(input.userId, input.chatbotId);
  const email = input.email?.trim() || null;
  const phone = input.phone?.trim() || null;
  const name = input.name?.trim() || null;
  if (!email && !phone && !name) {
    throw new Error('At least one lead contact field is required');
  }
  const now = new Date();

  return db().transaction(async (tx: any) => {
    const [row] = await tx
      .insert(aiLead)
      .values({
        id: getUuid(),
        userId: input.userId,
        chatbotId: input.chatbotId,
        conversationId: input.conversationId ?? null,
        name,
        email,
        phone,
        sourceUrl: input.sourceUrl?.trim() || null,
        status: 'new',
        priority: 'normal',
        metadata: JSON.stringify(input.metadata ?? {}),
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await writeAudit(tx, {
      userId: input.userId,
      resourceType: 'ai_lead',
      resourceId: row.id,
      action: 'lead.create',
      metadata: { chatbotId: input.chatbotId, conversationId: input.conversationId },
    });

    return row;
  });
}

export async function createPublicLead(input: Omit<CreateLeadInput, 'userId' | 'chatbotId'> & {
  publicKey: string;
}): Promise<AiLead> {
  const chatbot = await getPublicChatbot(input.publicKey);
  if (!chatbot) throw new Error('Chatbot not found');

  return createLead({
    userId: chatbot.userId,
    chatbotId: chatbot.id,
    conversationId: input.conversationId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    sourceUrl: input.sourceUrl,
    metadata: {
      ...(input.metadata ?? {}),
      source: 'public_widget',
    },
  });
}

export async function updateLead(input: UpdateLeadInput): Promise<AiLead> {
  const updates: Partial<typeof aiLead.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.status !== undefined) {
    assertOneOf(input.status, LEAD_STATUSES, 'lead status');
    updates.status = input.status;
  }
  if (input.priority !== undefined) {
    assertOneOf(input.priority, LEAD_PRIORITIES, 'lead priority');
    updates.priority = input.priority;
  }
  if (input.metadata !== undefined) updates.metadata = JSON.stringify(input.metadata);

  return db().transaction(async (tx: any) => {
    const [row] = await tx
      .update(aiLead)
      .set(updates)
      .where(and(eq(aiLead.id, input.id), eq(aiLead.userId, input.userId)))
      .returning();
    if (!row) throw new Error('Lead not found');

    await writeAudit(tx, {
      userId: input.userId,
      resourceType: 'ai_lead',
      resourceId: input.id,
      action: 'lead.update',
      diff: updates,
    });

    return row;
  });
}

export async function listEscalations(params: {
  userId: string;
  chatbotId?: string;
  status?: string;
}): Promise<AiHumanEscalation[]> {
  const conditions = [eq(aiHumanEscalation.userId, params.userId)];
  if (params.chatbotId) conditions.push(eq(aiHumanEscalation.chatbotId, params.chatbotId));
  if (params.status) conditions.push(eq(aiHumanEscalation.status, params.status));

  return db()
    .select()
    .from(aiHumanEscalation)
    .where(and(...conditions))
    .orderBy(desc(aiHumanEscalation.createdAt));
}

export async function createEscalation(
  input: CreateEscalationInput
): Promise<AiHumanEscalation> {
  await assertOwnsChatbot(input.userId, input.chatbotId);
  const now = new Date();

  return db().transaction(async (tx: any) => {
    const [row] = await tx
      .insert(aiHumanEscalation)
      .values({
        id: getUuid(),
        userId: input.userId,
        chatbotId: input.chatbotId,
        leadId: input.leadId ?? null,
        conversationId: input.conversationId ?? null,
        status: 'open',
        summary: input.summary?.trim() ?? '',
        metadata: JSON.stringify(input.metadata ?? {}),
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await writeAudit(tx, {
      userId: input.userId,
      resourceType: 'ai_human_escalation',
      resourceId: row.id,
      action: 'escalation.create',
      metadata: {
        chatbotId: input.chatbotId,
        leadId: input.leadId,
        conversationId: input.conversationId,
      },
    });

    return row;
  });
}

export async function createPublicEscalation(input: Omit<CreateEscalationInput, 'userId' | 'chatbotId'> & {
  publicKey: string;
}): Promise<AiHumanEscalation> {
  const chatbot = await getPublicChatbot(input.publicKey);
  if (!chatbot) throw new Error('Chatbot not found');
  const settings = await getHumanSupportSettings({ userId: chatbot.userId, chatbotId: chatbot.id });
  if (!settings.enabled) throw new Error('Human support is disabled');

  const row = await createEscalation({
    userId: chatbot.userId,
    chatbotId: chatbot.id,
    leadId: input.leadId,
    conversationId: input.conversationId,
    summary: input.summary,
    metadata: {
      ...(input.metadata ?? {}),
      source: 'public_widget',
      notificationQueued: settings.notificationsEnabled,
      notificationEmail: settings.notificationsEnabled
        ? redactPiiText(settings.notificationEmail)
        : undefined,
      notificationEmailConfigured: Boolean(settings.notificationEmail),
      notificationWebhookConfigured: Boolean(settings.notificationWebhookUrl),
    },
  });

  if (!settings.notificationsEnabled) {
    return row;
  }

  return deliverEscalationNotifications({
    userId: chatbot.userId,
    chatbot,
    escalation: row,
    settings,
    actorId: 'public_widget',
  });
}

export async function retryEscalationNotifications(params: {
  userId: string;
  id: string;
}): Promise<AiHumanEscalation> {
  const [escalation] = await db()
    .select()
    .from(aiHumanEscalation)
    .where(and(eq(aiHumanEscalation.id, params.id), eq(aiHumanEscalation.userId, params.userId)))
    .limit(1);
  if (!escalation) throw new Error('Escalation not found');

  const [chatbot] = await db()
    .select({
      id: aiChatbot.id,
      name: aiChatbot.name,
    })
    .from(aiChatbot)
    .where(
      and(
        eq(aiChatbot.id, escalation.chatbotId),
        eq(aiChatbot.userId, params.userId),
        isNull(aiChatbot.deletedAt)
      )
    )
    .limit(1);
  if (!chatbot) throw new Error('Chatbot not found');

  const settings = await getHumanSupportSettings({
    userId: params.userId,
    chatbotId: escalation.chatbotId,
  });
  const failedChannels = Array.from(
    new Set(
      readNotificationDeliveries(parseJsonObject(escalation.metadata))
        .filter((delivery) => delivery.status === 'failed')
        .map((delivery) => delivery.channel)
    )
  );

  return deliverEscalationNotifications({
    userId: params.userId,
    chatbot,
    escalation,
    settings,
    actorId: params.userId,
    retry: true,
    channels: failedChannels,
  });
}

export async function updateEscalation(
  input: UpdateEscalationInput
): Promise<AiHumanEscalation> {
  const updates: Partial<typeof aiHumanEscalation.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.status !== undefined) {
    assertOneOf(input.status, ESCALATION_STATUSES, 'escalation status');
    updates.status = input.status;
  }
  if (input.assigneeUserId !== undefined) updates.assigneeUserId = input.assigneeUserId;
  if (input.summary !== undefined) updates.summary = input.summary.trim();
  if (input.metadata !== undefined) updates.metadata = JSON.stringify(input.metadata);

  return db().transaction(async (tx: any) => {
    const [row] = await tx
      .update(aiHumanEscalation)
      .set(updates)
      .where(and(eq(aiHumanEscalation.id, input.id), eq(aiHumanEscalation.userId, input.userId)))
      .returning();
    if (!row) throw new Error('Escalation not found');

    await writeAudit(tx, {
      userId: input.userId,
      resourceType: 'ai_human_escalation',
      resourceId: input.id,
      action: 'escalation.update',
      diff: updates,
    });

    return row;
  });
}

export async function createAgentTokenDraft(input: {
  userId: string;
  name: string;
  scopes: string[];
  chatbotIds: string[];
  expiresAt?: Date | null;
}) {
  const name = input.name.trim();
  if (!name) throw new Error('Token name is required');
  if (name.length > 120) throw new Error('Token name is too long');

  const rawToken = `ai_${getNonceStr(40)}`;
  const tokenPrefix = rawToken.slice(0, 10);
  const tokenHash = md5(rawToken);
  const now = new Date();
  const scopes = input.scopes.length > 0 ? input.scopes : DEFAULT_AGENT_SCOPES;

  const row = await db().transaction(async (tx: any) => {
    const [record] = await tx
      .insert(aiAgentToken)
      .values({
        id: getUuid(),
        userId: input.userId,
        name,
        status: 'active',
        accessProfile: 'standard',
        scopes: JSON.stringify(scopes),
        chatbotIds: JSON.stringify(input.chatbotIds),
        tokenPrefix,
        tokenHash,
        expiresAt: input.expiresAt ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await tx.insert(aiAuditLog).values({
      id: getUuid(),
      userId: input.userId,
      actorType: 'user',
      actorId: input.userId,
      resourceType: 'ai_agent_token',
      resourceId: record.id,
      action: 'agent_token.create',
      requiresApproval: false,
      status: 'recorded',
      metadata: JSON.stringify({ name, scopes }),
      createdAt: now,
    });

    return record;
  });

  return { token: rawToken, record: row };
}

export async function listAgentTokens(userId: string): Promise<AiAgentTokenView[]> {
  const now = Date.now();
  const rows = await db()
    .select({
      id: aiAgentToken.id,
      name: aiAgentToken.name,
      status: aiAgentToken.status,
      accessProfile: aiAgentToken.accessProfile,
      scopes: aiAgentToken.scopes,
      chatbotIds: aiAgentToken.chatbotIds,
      tokenPrefix: aiAgentToken.tokenPrefix,
      expiresAt: aiAgentToken.expiresAt,
      lastUsedAt: aiAgentToken.lastUsedAt,
      createdAt: aiAgentToken.createdAt,
      revokedAt: aiAgentToken.revokedAt,
    })
    .from(aiAgentToken)
    .where(eq(aiAgentToken.userId, userId))
    .orderBy(desc(aiAgentToken.createdAt));

  return rows.map((row: (typeof rows)[number]) => ({
    ...row,
    status:
      row.status === 'active' && row.expiresAt && row.expiresAt.getTime() <= now
        ? 'expired'
        : row.status,
    scopes: parseJsonStringArray(row.scopes),
    chatbotIds: parseJsonStringArray(row.chatbotIds),
  }));
}

export async function authenticateAgentToken(rawToken: string, input: {
  scope: string;
  chatbotId?: string;
}): Promise<{ userId: string; tokenId: string; chatbotIds: string[]; scopes: string[] }> {
  if (!rawToken.startsWith('ai_') || rawToken.length < 20) throw new Error('Invalid agent token');
  const now = new Date();
  const [token] = await db().select().from(aiAgentToken).where(and(
    eq(aiAgentToken.tokenHash, md5(rawToken)),
    eq(aiAgentToken.status, 'active'),
    or(isNull(aiAgentToken.expiresAt), gt(aiAgentToken.expiresAt, now))
  )).limit(1);
  if (!token) throw new Error('Agent token is invalid, expired, or revoked');
  const scopes = parseJsonStringArray(token.scopes);
  const chatbotIds = parseJsonStringArray(token.chatbotIds);
  if (!scopes.includes(input.scope)) throw new Error('Agent token lacks required scope');
  if (input.chatbotId && chatbotIds.length > 0 && !chatbotIds.includes(input.chatbotId)) {
    throw new Error('Agent token is not authorized for this chatbot');
  }
  await db().update(aiAgentToken).set({ lastUsedAt: now, updatedAt: now }).where(eq(aiAgentToken.id, token.id));
  return { userId: token.userId, tokenId: token.id, chatbotIds, scopes };
}

export async function recordAgentAction(input: {
  userId: string;
  tokenId: string;
  chatbotId?: string;
  action: string;
  summary: string;
  status?: AgentRunStatus;
  approvalRequired?: boolean;
  diff?: unknown;
  metadata?: Record<string, unknown>;
}) {
  const now = new Date();
  return db().transaction(async (tx: any) => {
    const [run] = await tx.insert(aiAgentRun).values({
      id: getUuid(), userId: input.userId, agentTokenId: input.tokenId,
      chatbotId: input.chatbotId ?? null, action: input.action,
      status: input.status ?? 'approved', approvalRequired: input.approvalRequired ?? false,
      summary: input.summary.slice(0, 2000), diff: input.diff === undefined ? null : JSON.stringify(input.diff), metadata: JSON.stringify(input.metadata ?? {}),
      createdAt: now, completedAt: now,
    }).returning();
    await writeAudit(tx, {
      userId: input.userId, actorType: 'agent', actorId: input.tokenId,
      resourceType: 'ai_agent_run', resourceId: run.id, action: input.action,
      requiresApproval: input.approvalRequired ?? false, status: input.status ?? 'approved',
      metadata: { chatbotId: input.chatbotId, ...input.metadata },
    });
    return run;
  });
}

export async function revokeAgentToken(input: {
  userId: string;
  id: string;
}): Promise<AiAgentTokenView> {
  const now = new Date();

  return db().transaction(async (tx: any) => {
    const [row] = await tx
      .update(aiAgentToken)
      .set({
        status: 'revoked',
        revokedAt: now,
        updatedAt: now,
      })
      .where(and(eq(aiAgentToken.id, input.id), eq(aiAgentToken.userId, input.userId)))
      .returning();
    if (!row) throw new Error('Agent token not found');

    await writeAudit(tx, {
      userId: input.userId,
      resourceType: 'ai_agent_token',
      resourceId: input.id,
      action: 'agent_token.revoke',
      status: 'recorded',
      metadata: {
        name: row.name,
        tokenPrefix: row.tokenPrefix,
      },
    });

    return {
      ...row,
      scopes: parseJsonStringArray(row.scopes),
      chatbotIds: parseJsonStringArray(row.chatbotIds),
    };
  });
}

export async function listAgentRuns(params: {
  userId: string;
  status?: string;
  limit?: number;
}): Promise<AiAgentRun[]> {
  const safeLimit = Math.min(Math.max(Math.floor(params.limit ?? 20), 1), 50);
  const conditions = [eq(aiAgentRun.userId, params.userId)];
  if (params.status) {
    assertOneOf(params.status, AGENT_RUN_STATUSES, 'agent run status');
    conditions.push(eq(aiAgentRun.status, params.status));
  }

  return db()
    .select()
    .from(aiAgentRun)
    .where(and(...conditions))
    .orderBy(desc(aiAgentRun.createdAt))
    .limit(safeLimit);
}

export async function createAgentConfigDraft(input: CreateAgentRunInput): Promise<AiAgentRun> {
  await assertOwnsChatbot(input.userId, input.chatbotId);

  const action = input.action.trim() || 'config.propose';
  const summary = input.summary.trim();
  const settingKey = input.settingKey.trim();
  const content = input.content.trim();
  if (!summary) throw new Error('Summary is required');
  if (!settingKey) throw new Error('Setting key is required');
  if (!content) throw new Error('Content is required');

  const now = new Date();
  return db().transaction(async (tx: any) => {
    const [record] = await tx
      .insert(aiAgentRun)
      .values({
        id: getUuid(),
        userId: input.userId,
        agentTokenId: input.agentTokenId ?? null,
        chatbotId: input.chatbotId,
        action,
        status: 'pending_approval',
        approvalRequired: true,
        summary,
        diff: JSON.stringify({
          target: 'config_version',
          chatbotId: input.chatbotId,
          settingKey,
          content,
        }),
        metadata: JSON.stringify({ source: 'admin_console' }),
        createdAt: now,
      })
      .returning();

    await writeAudit(tx, {
      userId: input.userId,
      actorType: input.agentTokenId ? 'agent' : 'user',
      actorId: input.agentTokenId ?? input.userId,
      resourceType: 'ai_agent_run',
      resourceId: record.id,
      action: 'agent_run.propose',
      requiresApproval: true,
      status: 'pending_approval',
      diff: parseAgentConfigDiff(record.diff),
      metadata: { chatbotId: input.chatbotId, settingKey },
    });

    return record;
  });
}

export async function reviewAgentRun(input: ReviewAgentRunInput): Promise<AiAgentRun> {
  return db().transaction(async (tx: any) => {
    const [run] = await tx
      .select()
      .from(aiAgentRun)
      .where(and(eq(aiAgentRun.id, input.id), eq(aiAgentRun.userId, input.userId)))
      .limit(1);
    if (!run) throw new Error('Agent run not found');
    if (run.status !== 'pending_approval') {
      throw new Error('Agent run is not pending approval');
    }

    const now = new Date();
    let publishedVersion: AiConfigVersion | null = null;
    if (input.decision === 'approve') {
      const diff = parseAgentConfigDiff(run.diff);
      if (diff.target !== 'config_version' || !run.chatbotId || !diff.settingKey || !diff.content) {
        throw new Error('Agent run diff cannot be published');
      }
      await assertOwnsChatbot(input.userId, run.chatbotId);
      publishedVersion = await publishConfigVersion(tx, {
        userId: input.userId,
        chatbotId: run.chatbotId,
        settingKey: diff.settingKey,
        content: diff.content,
        createdByType: 'agent',
        createdById: run.agentTokenId,
        approvedByUserId: input.userId,
      });
    }

    const [updated] = await tx
      .update(aiAgentRun)
      .set({
        status: input.decision === 'approve' ? 'approved' : 'rejected',
        completedAt: now,
      })
      .where(eq(aiAgentRun.id, run.id))
      .returning();

    await writeAudit(tx, {
      userId: input.userId,
      resourceType: 'ai_agent_run',
      resourceId: run.id,
      action: input.decision === 'approve' ? 'agent_run.approve' : 'agent_run.reject',
      requiresApproval: false,
      status: 'recorded',
      diff: parseAgentConfigDiff(run.diff),
      metadata: {
        chatbotId: run.chatbotId,
        configVersionId: publishedVersion?.id,
      },
    });

    return updated;
  });
}

export async function listConfigVersions(params: {
  userId: string;
  chatbotId?: string;
  settingKey?: string;
  limit?: number;
}): Promise<AiConfigVersion[]> {
  const safeLimit = Math.min(Math.max(Math.floor(params.limit ?? 20), 1), 100);
  const conditions = [eq(aiConfigVersion.userId, params.userId)];
  if (params.chatbotId) conditions.push(eq(aiConfigVersion.chatbotId, params.chatbotId));
  if (params.settingKey) conditions.push(eq(aiConfigVersion.settingKey, params.settingKey));

  const rows = await db()
    .select()
    .from(aiConfigVersion)
    .where(and(...conditions))
    .orderBy(desc(aiConfigVersion.createdAt))
    .limit(safeLimit);
  return rows.map((row: AiConfigVersion) => ({
    ...row,
    content:
      row.settingKey === HUMAN_SUPPORT_SETTING_KEY
        ? redactHumanSupportSettingsContent(row.content)
        : row.settingKey === LAUNCH_OPERATIONS_SETTING_KEY
          ? redactLaunchOperationsContent(row.content)
        : row.content,
  }));
}

export async function rollbackConfigVersion(
  input: RollbackConfigVersionInput
): Promise<AiConfigVersion> {
  return db().transaction(async (tx: any) => {
    const [target] = await tx
      .select()
      .from(aiConfigVersion)
      .where(and(eq(aiConfigVersion.id, input.id), eq(aiConfigVersion.userId, input.userId)))
      .limit(1);
    if (!target) throw new Error('Config version not found');
    await assertOwnsChatbot(input.userId, target.chatbotId);

    const record = await publishConfigVersion(tx, {
      userId: input.userId,
      chatbotId: target.chatbotId,
      settingKey: target.settingKey,
      content: target.content,
      createdByType: 'user',
      createdById: input.userId,
      approvedByUserId: input.userId,
    });

    await writeAudit(tx, {
      userId: input.userId,
      resourceType: 'ai_config_version',
      resourceId: record.id,
      action: 'config_version.rollback',
      diff: {
        fromVersionId: target.id,
        settingKey: target.settingKey,
        version: record.version,
      },
      metadata: { chatbotId: target.chatbotId },
    });

    return record;
  });
}

export async function listAuditLogs(userId: string, limit = 20): Promise<AiAuditLog[]> {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 50);

  return db()
    .select()
    .from(aiAuditLog)
    .where(eq(aiAuditLog.userId, userId))
    .orderBy(desc(aiAuditLog.createdAt))
    .limit(safeLimit);
}

export async function getAiSupportOverview(userId: string): Promise<AiSupportOverview> {
  const chatbotCount = await getCount(
    aiChatbot as any,
    and(eq(aiChatbot.userId, userId), isNull(aiChatbot.deletedAt))
  );
  const installedChatbotCount = await getCount(
    aiChatbot as any,
    and(
      eq(aiChatbot.userId, userId),
      eq(aiChatbot.installStatus, 'installed'),
      isNull(aiChatbot.deletedAt)
    )
  );
  const knowledgeCount = await getCount(
    aiKnowledgeSource as any,
    and(eq(aiKnowledgeSource.userId, userId), isNull(aiKnowledgeSource.deletedAt))
  );
  const leadCount = await getCount(aiLead as any, eq(aiLead.userId, userId));
  const openEscalationCount = await getCount(
    aiHumanEscalation as any,
    and(eq(aiHumanEscalation.userId, userId), eq(aiHumanEscalation.status, 'open'))
  );
  const activeAgentTokenCount = await getCount(
    aiAgentToken as any,
    activeAgentTokenWhere(userId)
  );
  const pendingApprovalCount = await getCount(
    aiAgentRun as any,
    and(eq(aiAgentRun.userId, userId), eq(aiAgentRun.status, 'pending_approval'))
  );
  const publishedConfigCount = await getCount(
    aiConfigVersion as any,
    and(eq(aiConfigVersion.userId, userId), eq(aiConfigVersion.status, 'published'))
  );
  const [primaryChatbot] = await db()
    .select({
      id: aiChatbot.id,
      allowedDomains: aiChatbot.allowedDomains,
    })
    .from(aiChatbot)
    .where(and(eq(aiChatbot.userId, userId), isNull(aiChatbot.deletedAt)))
    .orderBy(desc(aiChatbot.createdAt))
    .limit(1);
  const launchOperations = primaryChatbot
    ? await getLaunchOperationsSettings({ userId, chatbotId: primaryChatbot.id })
    : DEFAULT_LAUNCH_OPERATIONS;
  const hasDomainWhitelist = primaryChatbot
    ? parseJsonStringArray(primaryChatbot.allowedDomains).length > 0
    : false;
  const productionOpsReady =
    launchOperations.backupConfigured &&
    launchOperations.errorAlertsEnabled &&
    Boolean(launchOperations.errorAlertWebhookUrl) &&
    launchOperations.logRetentionDays >= 7 &&
    launchOperations.rateLimitEnabled &&
    launchOperations.domainWhitelistRequired &&
    hasDomainWhitelist;

  const knowledgeSources = await Promise.all(
    KNOWLEDGE_TYPES.map(async (type) => {
      const total = await getCount(
        aiKnowledgeSource as any,
        and(
          eq(aiKnowledgeSource.userId, userId),
          eq(aiKnowledgeSource.type, type),
          isNull(aiKnowledgeSource.deletedAt)
        )
      );
      const ready = await getCount(
        aiKnowledgeSource as any,
        and(
          eq(aiKnowledgeSource.userId, userId),
          eq(aiKnowledgeSource.type, type),
          eq(aiKnowledgeSource.status, 'ready'),
          isNull(aiKnowledgeSource.deletedAt)
        )
      );
      return { type, total, ready, needsReview: Math.max(total - ready, 0) };
    })
  );

  const checklist: AiSupportChecklistItem[] = [
    { key: 'chatbot', status: statusForCount(chatbotCount) },
    { key: 'installation', status: installedChatbotCount > 0 ? 'ready' : 'warning' },
    { key: 'knowledge', status: statusForCount(knowledgeCount) },
    { key: 'human_support', status: openEscalationCount > 0 ? 'ready' : 'warning' },
    { key: 'agent_control', status: activeAgentTokenCount > 0 ? 'ready' : 'warning' },
    { key: 'versioning', status: publishedConfigCount > 0 ? 'ready' : 'warning' },
    { key: 'production_ops', status: productionOpsReady ? 'ready' : 'warning' },
  ];

  const recentAgentRuns = await db()
    .select({
      id: aiAgentRun.id,
      action: aiAgentRun.action,
      status: aiAgentRun.status,
      approvalRequired: aiAgentRun.approvalRequired,
      summary: aiAgentRun.summary,
      createdAt: aiAgentRun.createdAt,
    })
    .from(aiAgentRun)
    .where(eq(aiAgentRun.userId, userId))
    .orderBy(desc(aiAgentRun.createdAt))
    .limit(5);

  return {
    readiness: readinessFrom(checklist),
    metrics: [
      { key: 'chatbots', value: chatbotCount, status: statusForCount(chatbotCount) },
      { key: 'knowledge', value: knowledgeCount, status: statusForCount(knowledgeCount) },
      { key: 'leads', value: leadCount, status: statusForCount(leadCount) },
      {
        key: 'agent_actions',
        value: activeAgentTokenCount + pendingApprovalCount,
        status: activeAgentTokenCount > 0 ? 'ready' : 'warning',
      },
    ],
    checklist,
    knowledgeSources,
    agentPolicies: STANDARD_AGENT_POLICIES,
    pendingApprovals: pendingApprovalCount,
    recentAgentRuns,
  };
}

export async function getAiSupportUsage(userId: string): Promise<AiSupportUsage> {
  const now = new Date();
  const chatbots = await listChatbots(userId);

  const [
    knowledgeSources,
    readyKnowledgeSources,
    conversations,
    messages,
    leads,
    escalations,
    openEscalations,
    activeAgentTokens,
    pendingApprovals,
    auditEvents,
  ] = await Promise.all([
    getCount(
      aiKnowledgeSource as any,
      and(eq(aiKnowledgeSource.userId, userId), isNull(aiKnowledgeSource.deletedAt))
    ),
    getCount(
      aiKnowledgeSource as any,
      and(
        eq(aiKnowledgeSource.userId, userId),
        eq(aiKnowledgeSource.status, 'ready'),
        isNull(aiKnowledgeSource.deletedAt)
      )
    ),
    getCount(aiConversation as any, eq(aiConversation.userId, userId)),
    getCount(aiConversationMessage as any, eq(aiConversationMessage.userId, userId)),
    getCount(aiLead as any, eq(aiLead.userId, userId)),
    getCount(aiHumanEscalation as any, eq(aiHumanEscalation.userId, userId)),
    getCount(
      aiHumanEscalation as any,
      and(eq(aiHumanEscalation.userId, userId), eq(aiHumanEscalation.status, 'open'))
    ),
    getCount(
      aiAgentToken as any,
      activeAgentTokenWhere(userId, now)
    ),
    getCount(
      aiAgentRun as any,
      and(eq(aiAgentRun.userId, userId), eq(aiAgentRun.status, 'pending_approval'))
    ),
    getCount(aiAuditLog as any, eq(aiAuditLog.userId, userId)),
  ]);

  const byChatbot = await Promise.all(
    chatbots.map(async (chatbot) => {
      const [
        chatbotKnowledgeSources,
        chatbotConversations,
        chatbotMessages,
        chatbotLeads,
        chatbotEscalations,
        chatbotOpenEscalations,
      ] = await Promise.all([
        getCount(
          aiKnowledgeSource as any,
          and(
            eq(aiKnowledgeSource.userId, userId),
            eq(aiKnowledgeSource.chatbotId, chatbot.id),
            isNull(aiKnowledgeSource.deletedAt)
          )
        ),
        getCount(
          aiConversation as any,
          and(eq(aiConversation.userId, userId), eq(aiConversation.chatbotId, chatbot.id))
        ),
        getCount(
          aiConversationMessage as any,
          and(eq(aiConversationMessage.userId, userId), eq(aiConversationMessage.chatbotId, chatbot.id))
        ),
        getCount(
          aiLead as any,
          and(eq(aiLead.userId, userId), eq(aiLead.chatbotId, chatbot.id))
        ),
        getCount(
          aiHumanEscalation as any,
          and(eq(aiHumanEscalation.userId, userId), eq(aiHumanEscalation.chatbotId, chatbot.id))
        ),
        getCount(
          aiHumanEscalation as any,
          and(
            eq(aiHumanEscalation.userId, userId),
            eq(aiHumanEscalation.chatbotId, chatbot.id),
            eq(aiHumanEscalation.status, 'open')
          )
        ),
      ]);

      return {
        chatbotId: chatbot.id,
        name: chatbot.name,
        status: chatbot.status,
        installStatus: chatbot.installStatus,
        knowledgeSources: chatbotKnowledgeSources,
        conversations: chatbotConversations,
        messages: chatbotMessages,
        leads: chatbotLeads,
        escalations: chatbotEscalations,
        openEscalations: chatbotOpenEscalations,
      };
    })
  );

  return {
    generatedAt: now.toISOString(),
    resetAt: nextMonthResetDate(now).toISOString(),
    totals: {
      chatbots: chatbots.length,
      installedChatbots: chatbots.filter((chatbot) => chatbot.installStatus === 'installed').length,
      knowledgeSources,
      readyKnowledgeSources,
      conversations,
      messages,
      leads,
      escalations,
      openEscalations,
      activeAgentTokens,
      pendingApprovals,
      auditEvents,
    },
    byChatbot,
  };
}
