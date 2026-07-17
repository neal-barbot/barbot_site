import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bot, ShieldAlert } from 'lucide-react';
import { m } from '@/paraglide/messages.js';
import { apiPost } from '@/lib/api-client';
import { useSession } from '@/core/auth/client';
import { Link } from '@/core/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function isLoopback(callback: string): boolean {
  try {
    const url = new URL(callback);
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

function DesktopAuthPage() {
  const { callback } = Route.useSearch();
  const { data: session, isPending: sessionLoading } = useSession();
  const [done, setDone] = useState(false);

  const authorize = useMutation({
    mutationFn: () => apiPost<{ code: string }>('/api/auth/desktop/authorize', { callback }),
    onSuccess: ({ code }) => {
      setDone(true);
      const separator = callback.includes('?') ? '&' : '?';
      window.location.href = `${callback}${separator}code=${encodeURIComponent(code)}`;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const validCallback = callback.length > 0 && isLoopback(callback);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-md bg-foreground text-background">
              <Bot className="size-5" />
            </span>
            {m['console.desktop_auth.title']()}
          </CardTitle>
          <CardDescription>{m['console.desktop_auth.description']()}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!validCallback ? (
            <p className="text-sm text-destructive">{m['console.desktop_auth.invalid_callback']()}</p>
          ) : !sessionLoading && !session?.user ? (
            <>
              <p className="text-sm text-muted-foreground">
                {m['console.desktop_auth.signin_required']()}
              </p>
              <Link
                href="/sign-in"
                className="text-sm font-medium underline underline-offset-4"
              >
                {m['common.sign.sign_in_title']()}
              </Link>
            </>
          ) : done ? (
            <p className="text-sm font-medium text-green-600">
              {m['console.desktop_auth.approved']()}
            </p>
          ) : (
            <>
              <div className="flex items-start gap-2 rounded-md border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <span>{m['console.desktop_auth.warning']()}</span>
              </div>
              <p className="truncate text-xs text-muted-foreground" title={callback}>
                → {callback}
              </p>
              <Button
                className="w-full"
                disabled={authorize.isPending || sessionLoading}
                onClick={() => authorize.mutate()}
              >
                {m['console.desktop_auth.approve']()}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute('/auth/desktop')({
  validateSearch: (search: Record<string, unknown>) => ({
    callback: typeof search.callback === 'string' ? search.callback : '',
  }),
  component: DesktopAuthPage,
});
