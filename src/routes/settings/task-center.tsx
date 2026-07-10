import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock3, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiGet, apiPatch } from '@/lib/api-client';

type Task = { id: string; type: string; status: string; inputSummary: string; outputSummary: string; errorSummary: string; attempt: number; maxAttempts: number; createdAt: string };
type Trace = { task: Task; events: Array<{ id: string; sequence: number; type: string; summary: string; createdAt: string }>; checkpoints: Array<{ id: string; status: string; action: string; summary: string; expiresAt: string }> };

const terminal = new Set(['cancelled', 'succeeded', 'failed_terminal', 'rejected', 'expired']);

function TaskCenterPage() {
  const client = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const tasks = useQuery({ queryKey: ['agent-tasks'], queryFn: () => apiGet<Task[]>('/api/ai-support/tasks') });
  const trace = useQuery({ queryKey: ['agent-task-trace', selectedId], queryFn: () => apiGet<Trace>(`/api/ai-support/tasks?taskId=${encodeURIComponent(selectedId || '')}`), enabled: Boolean(selectedId) });
  const invalidate = () => { client.invalidateQueries({ queryKey: ['agent-tasks'] }); client.invalidateQueries({ queryKey: ['agent-task-trace', selectedId] }); };
  const action = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiPatch('/api/ai-support/tasks', body),
    onSuccess: () => { invalidate(); toast.success('Task updated'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const task = trace.data?.task;

  return <main className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">Task Center</h1><p className="text-sm text-muted-foreground">Trace, approvals and safe controls for Widget, knowledge and Agent work.</p></div>
      <Button variant="outline" onClick={() => invalidate()}><RotateCcw className="size-4" />Refresh</Button>
    </div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Card><CardHeader><CardTitle className="text-base">Tasks</CardTitle><CardDescription>Newest tasks across your workspace.</CardDescription></CardHeader><CardContent className="space-y-2">
        {tasks.isLoading ? <p className="text-sm text-muted-foreground">Loading tasks...</p> : null}
        {tasks.data?.length === 0 ? <p className="text-sm text-muted-foreground">No tasks have been created.</p> : null}
        {tasks.data?.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className="w-full border-b py-3 text-left last:border-0 hover:bg-muted/40">
          <div className="flex items-center justify-between gap-2"><span className="font-medium">{item.type}</span><Badge variant="outline">{item.status}</Badge></div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.inputSummary || item.outputSummary || item.errorSummary || 'No safe summary'}</p>
          <p className="mt-1 text-xs text-muted-foreground">Attempt {item.attempt}/{item.maxAttempts}</p>
        </button>)}
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">{task ? task.type : 'Task detail'}</CardTitle><CardDescription>{task ? `Task ${task.id}` : 'Select a task to inspect its safe trace.'}</CardDescription></CardHeader><CardContent className="space-y-5">
        {!task ? <p className="text-sm text-muted-foreground">Task events, checkpoint decisions and results appear here.</p> : <>
          <div className="flex flex-wrap gap-2"><Badge>{task.status}</Badge>{task.status === 'failed_retryable' ? <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ action: 'retry', taskId: task.id })}><RotateCcw className="size-4" />Retry</Button> : null}{['queued', 'running', 'waiting_input'].includes(task.status) ? <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ action: 'cancel', taskId: task.id })}><X className="size-4" />Cancel</Button> : null}{terminal.has(task.status) ? <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ action: 'archive', taskId: task.id })}>Archive</Button> : null}</div>
          <div className="space-y-2"><p className="text-sm font-medium">Checkpoint inbox</p>{trace.data?.checkpoints.map((checkpoint) => <div key={checkpoint.id} className="border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{checkpoint.action}</span><Badge variant="outline">{checkpoint.status}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{checkpoint.summary}</p>{checkpoint.status === 'waiting' ? <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => action.mutate({ action: 'checkpoint', taskId: task.id, checkpointId: checkpoint.id, decision: 'approve' })}><Check className="size-4" />Approve</Button><Button size="sm" variant="outline" onClick={() => action.mutate({ action: 'checkpoint', taskId: task.id, checkpointId: checkpoint.id, decision: 'reject' })}><X className="size-4" />Reject</Button></div> : null}</div>)}</div>
          <div className="space-y-3"><p className="text-sm font-medium">Trace</p>{trace.data?.events.map((event) => <div key={event.id} className="flex gap-3"><Clock3 className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><p className="text-sm font-medium">{event.type}</p><p className="text-sm text-muted-foreground">{event.summary}</p><p className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</p></div></div>)}</div>
        </>}
      </CardContent></Card>
    </div>
  </main>;
}

export const Route = createFileRoute('/settings/task-center')({ component: TaskCenterPage });
