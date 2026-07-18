import { useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bot, Loader2 } from 'lucide-react';
import { m } from '@/paraglide/messages.js';
import { apiPost } from '@/lib/api-client';
import { useSession } from '@/core/auth/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function isAllowedCallback(callback: string): boolean {
  try {
    const url = new URL(callback);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return true;
    const harveyUrl = import.meta.env.VITE_HARVEY_URL as string | undefined;
    if (harveyUrl && url.protocol === 'https:') {
      try {
        return url.hostname === new URL(harveyUrl).hostname;
      } catch {
        return false;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function DesktopAuthPage() {
  const { callback } = Route.useSearch();
  const { data: session, isPending: sessionLoading } = useSession();
  const [done, setDone] = useState(false);
  const startedRef = useRef(false);

  const authorize = useMutation({
    mutationFn: () => apiPost<{ code: string }>('/api/auth/desktop/authorize', { callback }),
    onSuccess: ({ code }) => {
      setDone(true);
      const separator = callback.includes('?') ? '&' : '?';
      window.location.href = `${callback}${separator}code=${encodeURIComponent(code)}`;
    },
    onError: (e: Error) => {
      startedRef.current = false;
      toast.error(e.message);
    },
  });

  const validCallback = callback.length > 0 && isAllowedCallback(callback);

  // Skip the consent screen: signed-in users are auto-approved for allowed
  // Harvey/loopback callbacks. Unsigned users go straight to sign-in and return here.
  useEffect(() => {
    if (!validCallback || sessionLoading || done || startedRef.current) return;

    if (!session?.user) {
      startedRef.current = true;
      const returnTo = `/auth/desktop?callback=${encodeURIComponent(callback)}`;
      window.location.href = `/sign-in?callbackUrl=${encodeURIComponent(returnTo)}`;
      return;
    }

    startedRef.current = true;
    authorize.mutate();
    // Intentionally omit `authorize` — mutate identity is stable enough; including
    // the whole mutation object re-fires and can double-redirect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validCallback, sessionLoading, session?.user, done, callback]);

  const statusText = done
    ? m['console.desktop_auth.approved']()
    : !session?.user && !sessionLoading
      ? m['console.desktop_auth.signin_required']()
      : 'Connecting to Harvey…';

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
          <CardDescription>{statusText}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!validCallback ? (
            <p className="text-sm text-destructive">{m['console.desktop_auth.invalid_callback']()}</p>
          ) : (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span>{statusText}</span>
            </div>
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
