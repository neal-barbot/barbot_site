import { and, asc, desc, eq, inArray, lte } from 'drizzle-orm';
import { db } from '@/core/db';
import {
  agentTask,
  agentTaskArtifact,
  agentTaskCheckpoint,
  agentTaskEvent,
  type AgentTask,
  type AgentTaskCheckpoint,
} from '@/config/db/schema';
import { getUuid } from '@/lib/hash';

export type AgentTaskStatus =
  | 'queued'
  | 'running'
  | 'waiting_approval'
  | 'waiting_input'
  | 'cancellation_requested'
  | 'cancelled'
  | 'succeeded'
  | 'failed_retryable'
  | 'failed_terminal'
  | 'rejected'
  | 'expired'
  | 'archived';

export type AgentTaskActorType =
  | 'human_session'
  | 'widget_visitor_session'
  | 'agent_bearer_token'
  | 'scheduler'
  | 'worker';

export interface AgentTaskActor {
  type: AgentTaskActorType;
  id: string;
  authorizationVersion?: string;
  requestId?: string;
}

export interface CreateAgentTaskInput {
  userId: string;
  chatbotId?: string | null;
  parentTaskId?: string | null;
  type: string;
  idempotencyKey: string;
  actor: AgentTaskActor;
  inputSummary?: string;
  metadata?: Record<string, unknown>;
  runAfter?: Date;
  attempt?: number;
  maxAttempts?: number;
}

export interface CreateTaskCheckpointInput {
  userId: string;
  taskId: string;
  action: string;
  summary: string;
  actor: AgentTaskActor;
  assigneeUserId?: string | null;
  expiresAt?: Date;
}

export interface AgentTaskTrace {
  task: AgentTask;
  events: Array<typeof agentTaskEvent.$inferSelect>;
  artifacts: Array<typeof agentTaskArtifact.$inferSelect>;
  checkpoints: AgentTaskCheckpoint[];
}

const terminalStatuses: AgentTaskStatus[] = [
  'cancelled',
  'succeeded',
  'failed_terminal',
  'rejected',
  'expired',
];

function summary(value: string | undefined, limit = 4000) {
  return (value ?? '').trim().slice(0, limit);
}

function json(value: Record<string, unknown> | undefined) {
  return JSON.stringify(value ?? {});
}

async function appendEvent(
  tx: any,
  input: {
    taskId: string;
    type: string;
    summary: string;
    actor: AgentTaskActor;
    details?: Record<string, unknown>;
  }
) {
  const [latest] = await tx
    .select({ sequence: agentTaskEvent.sequence })
    .from(agentTaskEvent)
    .where(eq(agentTaskEvent.taskId, input.taskId))
    .orderBy(desc(agentTaskEvent.sequence))
    .limit(1);

  const [event] = await tx
    .insert(agentTaskEvent)
    .values({
      id: getUuid(),
      taskId: input.taskId,
      sequence: (latest?.sequence ?? 0) + 1,
      type: input.type,
      summary: summary(input.summary),
      actorType: input.actor.type,
      actorId: input.actor.id,
      requestId: input.actor.requestId ?? '',
      details: json(input.details),
      createdAt: new Date(),
    })
    .returning();
  return event;
}

async function findOwnedTask(userId: string, taskId: string) {
  const [task] = await db()
    .select()
    .from(agentTask)
    .where(and(eq(agentTask.id, taskId), eq(agentTask.userId, userId)))
    .limit(1);
  if (!task) throw new Error('Task not found');
  return task;
}

export async function createAgentTask(input: CreateAgentTaskInput): Promise<{ task: AgentTask; created: boolean }> {
  const type = input.type.trim().slice(0, 100);
  const idempotencyKey = input.idempotencyKey.trim().slice(0, 191);
  if (!input.userId) throw new Error('Task user is required');
  if (!type) throw new Error('Task type is required');
  if (!idempotencyKey) throw new Error('Idempotency key is required');
  if (!input.actor.id.trim()) throw new Error('Task actor is required');

  const [existing] = await db()
    .select()
    .from(agentTask)
    .where(and(eq(agentTask.userId, input.userId), eq(agentTask.idempotencyKey, idempotencyKey)))
    .limit(1);
  if (existing) return { task: existing, created: false };

  return db().transaction(async (tx: any) => {
    // Recheck inside the transaction so common duplicate requests collapse to one task.
    const [again] = await tx
      .select()
      .from(agentTask)
      .where(and(eq(agentTask.userId, input.userId), eq(agentTask.idempotencyKey, idempotencyKey)))
      .limit(1);
    if (again) return { task: again, created: false };

    const now = new Date();
    const [task] = await tx
      .insert(agentTask)
      .values({
        id: getUuid(),
        userId: input.userId,
        chatbotId: input.chatbotId ?? null,
        parentTaskId: input.parentTaskId ?? null,
        type,
        status: 'queued',
        actorType: input.actor.type,
        actorId: input.actor.id.trim(),
        authorizationVersion: input.actor.authorizationVersion ?? '',
        requestId: input.actor.requestId ?? '',
        idempotencyKey,
        inputSummary: summary(input.inputSummary),
        outputSummary: '',
        errorSummary: '',
        metadata: json(input.metadata),
        attempt: Math.max(1, input.attempt ?? 1),
        maxAttempts: Math.max(1, input.maxAttempts ?? 5),
        runAfter: input.runAfter ?? now,
        createdAt: now,
      })
      .returning();

    await appendEvent(tx, {
      taskId: task.id,
      type: 'task.created',
      summary: `Queued ${type}`,
      actor: input.actor,
      details: { chatbotId: input.chatbotId ?? null, attempt: task.attempt },
    });
    return { task, created: true };
  });
}

export async function listAgentTasks(input: {
  userId: string;
  chatbotId?: string;
  statuses?: AgentTaskStatus[];
  limit?: number;
}) {
  const conditions = [eq(agentTask.userId, input.userId)];
  if (input.chatbotId) conditions.push(eq(agentTask.chatbotId, input.chatbotId));
  if (input.statuses?.length) conditions.push(inArray(agentTask.status, input.statuses));
  return db()
    .select()
    .from(agentTask)
    .where(and(...conditions))
    .orderBy(desc(agentTask.createdAt))
    .limit(Math.min(Math.max(input.limit ?? 50, 1), 100));
}

export async function getAgentTaskTrace(input: { userId: string; taskId: string }): Promise<AgentTaskTrace> {
  const task = await findOwnedTask(input.userId, input.taskId);
  const [events, artifacts, checkpoints] = await Promise.all([
    db().select().from(agentTaskEvent).where(eq(agentTaskEvent.taskId, task.id)).orderBy(asc(agentTaskEvent.sequence)),
    db().select().from(agentTaskArtifact).where(eq(agentTaskArtifact.taskId, task.id)).orderBy(asc(agentTaskArtifact.createdAt)),
    db().select().from(agentTaskCheckpoint).where(eq(agentTaskCheckpoint.taskId, task.id)).orderBy(asc(agentTaskCheckpoint.createdAt)),
  ]);
  return { task, events, artifacts, checkpoints };
}

export async function requestTaskCancellation(input: { userId: string; taskId: string; actor: AgentTaskActor }) {
  const task = await findOwnedTask(input.userId, input.taskId);
  if (!['queued', 'running', 'waiting_input'].includes(task.status)) {
    throw new Error('Task cannot be cancelled in its current state');
  }

  return db().transaction(async (tx: any) => {
    const [updated] = await tx
      .update(agentTask)
      .set({ status: 'cancellation_requested', cancellationRequestedAt: new Date() })
      .where(and(eq(agentTask.id, task.id), eq(agentTask.status, task.status)))
      .returning();
    if (!updated) throw new Error('Task state changed; retry the request');
    await appendEvent(tx, {
      taskId: task.id,
      type: 'task.cancellation_requested',
      summary: 'Cancellation requested; worker will stop at the next safe boundary',
      actor: input.actor,
    });
    return updated;
  });
}

export async function claimNextAgentTask(input: { workerId: string; leaseMs?: number; type?: string }) {
  const workerId = input.workerId.trim();
  if (!workerId) throw new Error('Worker id is required');
  const now = new Date();
  const conditions = [eq(agentTask.status, 'queued'), lte(agentTask.runAfter, now)];
  if (input.type) conditions.push(eq(agentTask.type, input.type));
  const [candidate] = await db()
    .select()
    .from(agentTask)
    .where(and(...conditions))
    .orderBy(asc(agentTask.runAfter), asc(agentTask.createdAt))
    .limit(1);
  if (!candidate) return null;

  return db().transaction(async (tx: any) => {
    const [task] = await tx
      .update(agentTask)
      .set({
        status: 'running',
        leaseOwner: workerId,
        leaseExpiresAt: new Date(now.getTime() + Math.max(1_000, input.leaseMs ?? 120_000)),
        startedAt: candidate.startedAt ?? now,
      })
      .where(and(eq(agentTask.id, candidate.id), eq(agentTask.status, 'queued')))
      .returning();
    if (!task) return null;
    await appendEvent(tx, {
      taskId: task.id,
      type: 'task.claimed',
      summary: 'Worker lease acquired',
      actor: { type: 'worker', id: workerId },
      details: { leaseExpiresAt: task.leaseExpiresAt?.toISOString() ?? null },
    });
    return task;
  });
}

export async function claimAgentTask(input: { userId: string; taskId: string; workerId: string; leaseMs?: number }) {
  const workerId = input.workerId.trim();
  if (!workerId) throw new Error('Worker id is required');
  const now = new Date();
  const [task] = await db()
    .update(agentTask)
    .set({
      status: 'running',
      leaseOwner: workerId,
      leaseExpiresAt: new Date(now.getTime() + Math.max(1_000, input.leaseMs ?? 120_000)),
      startedAt: now,
    })
    .where(and(
      eq(agentTask.id, input.taskId),
      eq(agentTask.userId, input.userId),
      eq(agentTask.status, 'queued'),
      lte(agentTask.runAfter, now)
    ))
    .returning();
  if (!task) return null;
  await db().transaction(async (tx: any) => {
    await appendEvent(tx, {
      taskId: task.id,
      type: 'task.claimed',
      summary: 'Worker lease acquired',
      actor: { type: 'worker', id: workerId },
      details: { leaseExpiresAt: task.leaseExpiresAt?.toISOString() ?? null },
    });
  });
  return task;
}

export async function getPublicAgentTaskStatus(input: {
  userId: string;
  chatbotId: string;
  taskId: string;
  conversationId: string;
  pollTokenHash: string;
}) {
  const [task] = await db()
    .select()
    .from(agentTask)
    .where(and(
      eq(agentTask.id, input.taskId),
      eq(agentTask.userId, input.userId),
      eq(agentTask.chatbotId, input.chatbotId)
    ))
    .limit(1);
  if (!task) throw new Error('Task not found');
  let metadata: Record<string, unknown> = {};
  try { metadata = JSON.parse(task.metadata || '{}'); } catch { throw new Error('Task metadata is invalid'); }
  if (metadata.conversationId !== input.conversationId || metadata.pollTokenHash !== input.pollTokenHash) {
    throw new Error('Task access denied');
  }
  const expiresAt = typeof metadata.pollTokenExpiresAt === 'string' ? Date.parse(metadata.pollTokenExpiresAt) : NaN;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new Error('Task poll token has expired');
  return { id: task.id, status: task.status, outputSummary: task.outputSummary, errorSummary: task.errorSummary };
}

export async function updateQueuedTaskMetadata(input: {
  userId: string;
  taskId: string;
  metadata: Record<string, unknown>;
}) {
  const [task] = await db()
    .update(agentTask)
    .set({ metadata: json(input.metadata) })
    .where(and(eq(agentTask.id, input.taskId), eq(agentTask.userId, input.userId), eq(agentTask.status, 'queued')))
    .returning();
  if (!task) throw new Error('Queued task not found');
  return task;
}

export async function createTaskCheckpoint(input: CreateTaskCheckpointInput) {
  const task = await findOwnedTask(input.userId, input.taskId);
  if (task.status !== 'running') throw new Error('Only a running task can request approval');
  const action = input.action.trim().slice(0, 191);
  const checkpointSummary = summary(input.summary);
  if (!action || !checkpointSummary) throw new Error('Checkpoint action and summary are required');

  return db().transaction(async (tx: any) => {
    const now = new Date();
    const [checkpoint] = await tx
      .insert(agentTaskCheckpoint)
      .values({
        id: getUuid(), taskId: task.id, status: 'waiting', action, summary: checkpointSummary,
        requestedByType: input.actor.type, requestedById: input.actor.id,
        assigneeUserId: input.assigneeUserId ?? task.userId,
        decisionReason: '', expiresAt: input.expiresAt ?? new Date(now.getTime() + 24 * 60 * 60 * 1000), createdAt: now,
      })
      .returning();
    await tx.update(agentTask).set({ status: 'waiting_approval', leaseOwner: null, leaseExpiresAt: null }).where(eq(agentTask.id, task.id));
    await appendEvent(tx, {
      taskId: task.id, type: 'checkpoint.created', summary: checkpointSummary, actor: input.actor,
      details: { checkpointId: checkpoint.id, action, expiresAt: checkpoint.expiresAt.toISOString() },
    });
    return checkpoint;
  });
}

export async function completeAgentTask(input: {
  userId: string;
  taskId: string;
  workerId: string;
  status: 'succeeded' | 'failed_retryable' | 'failed_terminal' | 'cancelled';
  outputSummary?: string;
  errorSummary?: string;
  details?: Record<string, unknown>;
}) {
  const task = await findOwnedTask(input.userId, input.taskId);
  if (!['running', 'cancellation_requested'].includes(task.status)) {
    throw new Error('Task is not running');
  }
  if (task.leaseOwner !== input.workerId) throw new Error('Task lease is owned by another worker');
  if (task.status === 'cancellation_requested' && input.status !== 'cancelled') {
    throw new Error('Cancellation requested tasks must be cancelled at a safe boundary');
  }

  return db().transaction(async (tx: any) => {
    const now = new Date();
    const [updated] = await tx
      .update(agentTask)
      .set({
        status: input.status,
        outputSummary: summary(input.outputSummary),
        errorSummary: summary(input.errorSummary),
        leaseOwner: null,
        leaseExpiresAt: null,
        completedAt: now,
      })
      .where(and(eq(agentTask.id, task.id), eq(agentTask.leaseOwner, input.workerId)))
      .returning();
    if (!updated) throw new Error('Task lease changed; retry the operation');
    await appendEvent(tx, {
      taskId: task.id,
      type: `task.${input.status}`,
      summary: input.status === 'succeeded'
        ? summary(input.outputSummary) || 'Task completed'
        : summary(input.errorSummary) || `Task ${input.status}`,
      actor: { type: 'worker', id: input.workerId },
      details: input.details,
    });
    return updated;
  });
}

export async function retryAgentTask(input: {
  userId: string;
  taskId: string;
  actor: AgentTaskActor;
  runAfter?: Date;
}) {
  const task = await findOwnedTask(input.userId, input.taskId);
  if (task.status !== 'failed_retryable') throw new Error('Only retryable failed tasks can be retried');
  if (task.attempt >= task.maxAttempts) throw new Error('Task retry limit reached');

  const retry = await createAgentTask({
    userId: task.userId,
    chatbotId: task.chatbotId,
    parentTaskId: task.id,
    type: task.type,
    idempotencyKey: `${task.id}:retry:${task.attempt + 1}`,
    actor: input.actor,
    inputSummary: task.inputSummary,
    metadata: JSON.parse(task.metadata || '{}'),
    runAfter: input.runAfter,
    attempt: task.attempt + 1,
    maxAttempts: task.maxAttempts,
  });
  await db().transaction(async (tx: any) => {
    await appendEvent(tx, {
      taskId: task.id,
      type: 'task.retry_created',
      summary: `Created retry attempt ${retry.task.attempt}`,
      actor: input.actor,
      details: { retryTaskId: retry.task.id },
    });
  });
  return retry.task;
}

export async function decideTaskCheckpoint(input: {
  userId: string;
  checkpointId: string;
  decision: 'approve' | 'reject';
  reason?: string;
  actor: AgentTaskActor;
}) {
  const [checkpoint] = await db()
    .select({ checkpoint: agentTaskCheckpoint, task: agentTask })
    .from(agentTaskCheckpoint)
    .innerJoin(agentTask, eq(agentTaskCheckpoint.taskId, agentTask.id))
    .where(and(eq(agentTaskCheckpoint.id, input.checkpointId), eq(agentTask.userId, input.userId)))
    .limit(1);
  if (!checkpoint) throw new Error('Checkpoint not found');
  if (checkpoint.checkpoint.status !== 'waiting') throw new Error('Checkpoint is already decided');
  if (checkpoint.checkpoint.expiresAt.getTime() <= Date.now()) throw new Error('Checkpoint has expired');

  return db().transaction(async (tx: any) => {
    const now = new Date();
    const status = input.decision === 'approve' ? 'approved' : 'rejected';
    const [updated] = await tx
      .update(agentTaskCheckpoint)
      .set({ status, decisionByUserId: input.userId, decisionReason: summary(input.reason), decidedAt: now })
      .where(and(eq(agentTaskCheckpoint.id, checkpoint.checkpoint.id), eq(agentTaskCheckpoint.status, 'waiting')))
      .returning();
    if (!updated) throw new Error('Checkpoint state changed; retry the request');
    await tx.update(agentTask).set({
      status: input.decision === 'approve' ? 'queued' : 'rejected',
      runAfter: now,
      completedAt: input.decision === 'approve' ? null : now,
    }).where(eq(agentTask.id, checkpoint.task.id));
    await appendEvent(tx, {
      taskId: checkpoint.task.id,
      type: input.decision === 'approve' ? 'checkpoint.approved' : 'checkpoint.rejected',
      summary: summary(input.reason) || `Checkpoint ${status}`,
      actor: input.actor,
      details: { checkpointId: updated.id, action: updated.action },
    });
    return updated;
  });
}

export async function archiveAgentTask(input: { userId: string; taskId: string; actor: AgentTaskActor }) {
  const task = await findOwnedTask(input.userId, input.taskId);
  if (!terminalStatuses.includes(task.status as AgentTaskStatus)) throw new Error('Only terminal tasks can be archived');
  return db().transaction(async (tx: any) => {
    const [updated] = await tx
      .update(agentTask)
      .set({ status: 'archived', archivedAt: new Date() })
      .where(and(eq(agentTask.id, task.id), eq(agentTask.status, task.status)))
      .returning();
    if (!updated) throw new Error('Task state changed; retry the request');
    await appendEvent(tx, { taskId: task.id, type: 'task.archived', summary: 'Task archived', actor: input.actor });
    return updated;
  });
}

export async function recoverExpiredAgentTaskLeases(input: { workerId: string; limit?: number }) {
  const now = new Date();
  const rows = await db().select().from(agentTask).where(and(
    eq(agentTask.status, 'running'),
    lte(agentTask.leaseExpiresAt, now)
  )).orderBy(asc(agentTask.leaseExpiresAt)).limit(Math.min(Math.max(input.limit ?? 25, 1), 100));
  let recovered = 0;
  for (const task of rows) {
    const updated = await db().transaction(async (tx: any) => {
      const [row] = await tx.update(agentTask).set({
        status: 'queued', leaseOwner: null, leaseExpiresAt: null, runAfter: now,
      }).where(and(eq(agentTask.id, task.id), eq(agentTask.status, 'running'), lte(agentTask.leaseExpiresAt, now))).returning();
      if (!row) return false;
      await appendEvent(tx, {
        taskId: task.id, type: 'task.lease_recovered', summary: 'Expired worker lease recovered and task requeued',
        actor: { type: 'worker', id: input.workerId }, details: { previousLeaseOwner: task.leaseOwner },
      });
      return true;
    });
    if (updated) recovered += 1;
  }
  return recovered;
}

export async function expireDueTaskCheckpoints(input: { workerId: string; limit?: number }) {
  const now = new Date();
  const rows = await db().select().from(agentTaskCheckpoint).where(and(
    eq(agentTaskCheckpoint.status, 'waiting'), lte(agentTaskCheckpoint.expiresAt, now)
  )).orderBy(asc(agentTaskCheckpoint.expiresAt)).limit(Math.min(Math.max(input.limit ?? 25, 1), 100));
  let expired = 0;
  for (const checkpoint of rows) {
    const updated = await db().transaction(async (tx: any) => {
      const [row] = await tx.update(agentTaskCheckpoint).set({ status: 'expired', decidedAt: now, decisionReason: 'Checkpoint expired after 24 hours' })
        .where(and(eq(agentTaskCheckpoint.id, checkpoint.id), eq(agentTaskCheckpoint.status, 'waiting'))).returning();
      if (!row) return false;
      await tx.update(agentTask).set({ status: 'expired', completedAt: now, leaseOwner: null, leaseExpiresAt: null })
        .where(and(eq(agentTask.id, checkpoint.taskId), eq(agentTask.status, 'waiting_approval')));
      await appendEvent(tx, {
        taskId: checkpoint.taskId, type: 'checkpoint.expired', summary: 'Checkpoint expired without executing the requested action',
        actor: { type: 'worker', id: input.workerId }, details: { checkpointId: checkpoint.id },
      });
      return true;
    });
    if (updated) expired += 1;
  }
  return expired;
}
