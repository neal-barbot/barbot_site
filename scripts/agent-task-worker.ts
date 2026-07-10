import { completeAgentTask, claimNextAgentTask, expireDueTaskCheckpoints, recoverExpiredAgentTaskLeases, retryAgentTask } from '@/modules/agent-tasks/service';
import { answerPublicConversationMessage, runConfiguredKnowledgeSync } from '@/modules/ai-support/service';

function metadata(value: string): Record<string, unknown> {
  try { return JSON.parse(value || '{}'); } catch { return {}; }
}

const workerId = process.env.AGENT_TASK_WORKER_ID || `widget-worker-${process.pid}`;
const limit = Math.min(Math.max(Number(process.env.AGENT_TASK_WORKER_LIMIT ?? '10') || 10, 1), 100);

await recoverExpiredAgentTaskLeases({ workerId, limit });
await expireDueTaskCheckpoints({ workerId, limit });

const retryDelaysMinutes = [1, 5, 15, 60, 240];

async function scheduleRetry(task: { userId: string; id: string; attempt: number; maxAttempts: number }) {
  if (task.attempt >= task.maxAttempts) return;
  const delay = retryDelaysMinutes[Math.min(task.attempt - 1, retryDelaysMinutes.length - 1)];
  await retryAgentTask({
    userId: task.userId,
    taskId: task.id,
    actor: { type: 'worker', id: workerId },
    runAfter: new Date(Date.now() + delay * 60_000),
  });
}

async function processKnowledgeSyncTask() {
  const task = await claimNextAgentTask({ workerId, type: 'knowledge.sync' });
  if (!task) return false;
  const data = metadata(task.metadata);
  try {
    const sourceId = typeof data.sourceId === 'string' ? data.sourceId : '';
    if (!sourceId) throw new Error('Knowledge sync task metadata is incomplete');
    const result = await runConfiguredKnowledgeSync({ userId: task.userId, sourceId });
    await completeAgentTask({
      userId: task.userId, taskId: task.id, workerId, status: 'succeeded',
      outputSummary: `Knowledge source synced: ${result.title}`,
      details: { sourceId, status: result.status },
    });
  } catch (error) {
    await completeAgentTask({
      userId: task.userId, taskId: task.id, workerId, status: 'failed_retryable',
      errorSummary: error instanceof Error ? error.message : 'Knowledge sync worker failed',
    });
    await scheduleRetry(task);
  }
  return true;
}

for (let count = 0; count < limit; count += 1) {
  const widgetTask = await claimNextAgentTask({ workerId, type: 'widget.answer' });
  if (widgetTask) {
    const task = widgetTask;
    const data = metadata(task.metadata);
    try {
      const publicKey = typeof data.publicKey === 'string' ? data.publicKey : '';
      const conversationId = typeof data.conversationId === 'string' ? data.conversationId : '';
      const userMessageId = typeof data.userMessageId === 'string' ? data.userMessageId : '';
      if (!publicKey || !conversationId || !userMessageId || !task.chatbotId) throw new Error('Widget task metadata is incomplete');
      const result = await answerPublicConversationMessage({ publicKey, conversationId, userMessageId });
      await completeAgentTask({ userId: task.userId, taskId: task.id, workerId, status: 'succeeded', outputSummary: 'Widget answer delivered', details: { conversationId: result.conversation.id, assistantMessageId: result.assistantMessage.id } });
    } catch (error) {
      await completeAgentTask({ userId: task.userId, taskId: task.id, workerId, status: 'failed_retryable', errorSummary: error instanceof Error ? error.message : 'Widget answer worker failed' });
      await scheduleRetry(task);
    }
    continue;
  }
  if (!await processKnowledgeSyncTask()) break;
}
