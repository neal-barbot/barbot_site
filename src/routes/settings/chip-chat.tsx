import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bot, Loader2, MessageSquare, Plus, Send, Trash2 } from 'lucide-react';
import { m } from '@/paraglide/messages.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { MarkdownContent } from '@/components/markdown-content';
import { apiDelete, apiGet, apiPost } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface ChatItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface MessageItem {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface ThreadData {
  chat: ChatItem;
  messages: MessageItem[];
}

function ChipChatPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatItem | null>(null);
  const [input, setInput] = useState('');
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatsQuery = useQuery({
    queryKey: ['chip-chats'],
    queryFn: () => apiGet<{ items: ChatItem[] }>('/api/chip-compare/chats'),
  });
  const chats = chatsQuery.data?.items ?? [];

  const threadQuery = useQuery({
    queryKey: ['chip-chat-thread', selectedId],
    queryFn: () => apiGet<ThreadData>(`/api/chip-compare/chats/${selectedId}`),
    enabled: !!selectedId,
  });
  const messages = threadQuery.data?.messages ?? [];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, pendingQuestion]);

  const createMutation = useMutation({
    mutationFn: () => apiPost<ChatItem>('/api/chip-compare/chats', {}),
    onSuccess: (created) => {
      setSelectedId(created.id);
      queryClient.invalidateQueries({ queryKey: ['chip-chats'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (chatId: string) => apiDelete(`/api/chip-compare/chats/${chatId}`),
    onSuccess: (_data, chatId) => {
      toast.success(m['chat.deleted']());
      setDeleteTarget(null);
      if (selectedId === chatId) setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ['chip-chats'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMutation = useMutation({
    mutationFn: (vars: { chatId: string; content: string }) =>
      apiPost<MessageItem>(`/api/chip-compare/chats/${vars.chatId}`, {
        content: vars.content,
      }),
    onError: (e: Error) => toast.error(e.message || m['chat.error']()),
    onSettled: (_data, _error, vars) => {
      setPendingQuestion(null);
      queryClient.invalidateQueries({ queryKey: ['chip-chat-thread', vars.chatId] });
      queryClient.invalidateQueries({ queryKey: ['chip-chats'] });
    },
  });

  function send() {
    const content = input.trim();
    if (!content || !selectedId || sendMutation.isPending) return;
    setInput('');
    setPendingQuestion(content);
    sendMutation.mutate({ chatId: selectedId, content });
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{m['chat.title']()}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{m['chat.subtitle']()}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Session list */}
        <Card className="lg:h-[calc(100vh-14rem)]">
          <CardContent className="flex h-full flex-col gap-3 p-3">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {m['chat.new_chat']()}
            </Button>
            <div className="flex-1 space-y-1 overflow-y-auto">
              {chatsQuery.isLoading && (
                <div className="flex justify-center py-6 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              )}
              {!chatsQuery.isLoading && chats.length === 0 && (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  {m['chat.empty_sessions']()}
                </p>
              )}
              {chats.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm',
                    selectedId === item.id
                      ? 'bg-muted font-medium'
                      : 'hover:bg-muted/60 text-muted-foreground'
                  )}
                  onClick={() => setSelectedId(item.id)}
                >
                  <MessageSquare className="size-4 shrink-0" />
                  <span className="flex-1 truncate">
                    {item.title || m['chat.untitled']()}
                  </span>
                  <button
                    className="hidden shrink-0 text-muted-foreground hover:text-destructive group-hover:block"
                    aria-label={m['chat.delete']()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(item);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Thread */}
        <Card className="flex h-[calc(100vh-14rem)] flex-col">
          <CardContent className="flex h-full flex-col gap-3 p-4">
            {!selectedId ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
                <Bot className="size-8" />
                <p className="text-sm">{m['chat.select_hint']()}</p>
              </div>
            ) : (
              <>
                <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pr-1">
                  {threadQuery.isLoading && (
                    <div className="flex justify-center py-8 text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                    </div>
                  )}
                  {!threadQuery.isLoading && messages.length === 0 && !pendingQuestion && (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      {m['chat.empty_thread']()}
                    </p>
                  )}
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm',
                        msg.role === 'user'
                          ? 'ml-auto bg-primary text-primary-foreground'
                          : 'bg-muted'
                      )}
                    >
                      {msg.role === 'assistant' ? (
                        <MarkdownContent
                          content={msg.content}
                          className="text-sm [&_p]:mt-0"
                        />
                      ) : (
                        msg.content
                      )}
                    </div>
                  ))}
                  {pendingQuestion && (
                    <>
                      <div className="ml-auto max-w-[85%] rounded-2xl bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                        {pendingQuestion}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        {m['chat.thinking']()}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex gap-2 border-t border-border pt-3">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder={m['chat.input_placeholder']()}
                    disabled={sendMutation.isPending}
                  />
                  <Button
                    onClick={send}
                    disabled={sendMutation.isPending || !input.trim()}
                    aria-label={m['chat.send']()}
                  >
                    {sendMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m['chat.delete_confirm_title']()}</DialogTitle>
            <DialogDescription>{m['chat.delete_confirm_desc']()}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {m['chat.cancel']()}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {m['chat.delete']()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute('/settings/chip-chat')({
  component: ChipChatPage,
});
