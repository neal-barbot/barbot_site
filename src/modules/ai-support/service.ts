import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/core/db';
import {
  aiAgentRun,
  aiAgentToken,
  aiAuditLog,
  aiChatbot,
  aiConfigVersion,
  aiHumanEscalation,
  aiKnowledgeSource,
  aiLead,
  type AiChatbot,
  type AiAuditLog,
  type AiHumanEscalation,
  type AiKnowledgeSource,
  type AiLead,
} from '@/config/db/schema';
import { getNonceStr, getUuid, md5 } from '@/lib/hash';

export type AiSupportStatus = 'ready' | 'warning' | 'blocked';
export type ChatbotStatus = 'draft' | 'active' | 'paused' | 'archived';
export type ChatbotInstallStatus = 'not_installed' | 'installed' | 'error';
export type KnowledgeSourceType = 'custom_response' | 'text_snippet' | 'website_link' | 'file';
export type KnowledgeSourceStatus = 'draft' | 'ready' | 'needs_review' | 'archived';
export type LeadStatus = 'new' | 'qualified' | 'contacted' | 'closed';
export type LeadPriority = 'low' | 'normal' | 'high';
export type EscalationStatus = 'open' | 'assigned' | 'closed';

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
const LEAD_STATUSES: LeadStatus[] = ['new', 'qualified', 'contacted', 'closed'];
const LEAD_PRIORITIES: LeadPriority[] = ['low', 'normal', 'high'];
const ESCALATION_STATUSES: EscalationStatus[] = ['open', 'assigned', 'closed'];

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

  return {
    chatbotId: chatbot.id,
    publicKey: chatbot.publicKey,
    name: chatbot.name,
    description: chatbot.description,
    installStatus: chatbot.installStatus,
    allowedDomains: parseJsonStringArray(chatbot.allowedDomains),
    humanSupportEnabled: true,
    leadCaptureEnabled: true,
  };
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

  return db()
    .select()
    .from(aiLead)
    .where(and(...conditions))
    .orderBy(desc(aiLead.createdAt));
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

  return createEscalation({
    userId: chatbot.userId,
    chatbotId: chatbot.id,
    leadId: input.leadId,
    conversationId: input.conversationId,
    summary: input.summary,
    metadata: {
      ...(input.metadata ?? {}),
      source: 'public_widget',
    },
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
    scopes: parseJsonStringArray(row.scopes),
    chatbotIds: parseJsonStringArray(row.chatbotIds),
  }));
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
    and(eq(aiAgentToken.userId, userId), eq(aiAgentToken.status, 'active'))
  );
  const pendingApprovalCount = await getCount(
    aiAgentRun as any,
    and(eq(aiAgentRun.userId, userId), eq(aiAgentRun.status, 'pending_approval'))
  );
  const publishedConfigCount = await getCount(
    aiConfigVersion as any,
    and(eq(aiConfigVersion.userId, userId), eq(aiConfigVersion.status, 'published'))
  );

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
