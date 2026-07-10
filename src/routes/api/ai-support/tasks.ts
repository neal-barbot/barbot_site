import { createFileRoute } from '@tanstack/react-router';
import { getAuth } from '@/core/auth';
import {
  archiveAgentTask,
  decideTaskCheckpoint,
  getAgentTaskTrace,
  listAgentTasks,
  requestTaskCancellation,
  retryAgentTask,
  type AgentTaskStatus,
} from '@/modules/agent-tasks/service';
import { respData, respErr } from '@/lib/resp';

const statuses = new Set<AgentTaskStatus>([
  'queued', 'running', 'waiting_approval', 'waiting_input', 'cancellation_requested',
  'cancelled', 'succeeded', 'failed_retryable', 'failed_terminal', 'rejected', 'expired', 'archived',
]);

async function getUser(request: Request) {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw new Error('Unauthorized');
  return session.user;
}

function actor(userId: string, request: Request) {
  return {
    type: 'human_session' as const,
    id: userId,
    requestId: request.headers.get('x-request-id') ?? '',
    authorizationVersion: 'session',
  };
}

async function GET({ request }: { request: Request }) {
  try {
    const user = await getUser(request);
    const url = new URL(request.url);
    const taskId = url.searchParams.get('taskId');
    if (taskId) return respData(await getAgentTaskTrace({ userId: user.id, taskId }));

    const requestedStatuses = url.searchParams.getAll('status').filter((value): value is AgentTaskStatus => statuses.has(value as AgentTaskStatus));
    const limit = Number(url.searchParams.get('limit') ?? '50');
    return respData(await listAgentTasks({
      userId: user.id,
      chatbotId: url.searchParams.get('chatbotId') || undefined,
      statuses: requestedStatuses.length ? requestedStatuses : undefined,
      limit: Number.isFinite(limit) ? limit : 50,
    }));
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

async function PATCH({ request }: { request: Request }) {
  try {
    const user = await getUser(request);
    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === 'string' ? body.action : '';
    const taskId = typeof body.taskId === 'string' ? body.taskId : '';
    if (!taskId) return respErr('Task id is required');

    if (action === 'cancel') {
      return respData(await requestTaskCancellation({ userId: user.id, taskId, actor: actor(user.id, request) }));
    }
    if (action === 'archive') {
      return respData(await archiveAgentTask({ userId: user.id, taskId, actor: actor(user.id, request) }));
    }
    if (action === 'retry') {
      return respData(await retryAgentTask({ userId: user.id, taskId, actor: actor(user.id, request) }));
    }
    if (action === 'checkpoint') {
      const checkpointId = typeof body.checkpointId === 'string' ? body.checkpointId : '';
      const decision = body.decision === 'approve' || body.decision === 'reject' ? body.decision : null;
      if (!checkpointId || !decision) return respErr('Checkpoint id and decision are required');
      return respData(await decideTaskCheckpoint({
        userId: user.id,
        checkpointId,
        decision,
        reason: typeof body.reason === 'string' ? body.reason : undefined,
        actor: actor(user.id, request),
      }));
    }
    return respErr('Unsupported task action');
  } catch (error: any) {
    return respErr(error.message || 'Internal error');
  }
}

export const Route = createFileRoute('/api/ai-support/tasks')({
  server: { handlers: { GET, PATCH } },
});
