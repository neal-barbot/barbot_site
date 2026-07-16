import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MonitorSmartphone, ShieldAlert } from 'lucide-react';
import { m } from '@/paraglide/messages.js';
import { apiGet, apiPost } from '@/lib/api-client';
import { useSession } from '@/core/auth/client';
import { Link } from '@/core/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type DeviceStatus = { userCode: string; status: 'pending' | 'approved' | 'denied' };

function DeviceAuthPage() {
  const { code } = Route.useSearch();
  const { data: session, isPending: sessionLoading } = useSession();
  const [userCode, setUserCode] = useState(code);
  const [decision, setDecision] = useState<'approved' | 'denied' | null>(null);

  const statusQuery = useQuery({
    queryKey: ['device-code', userCode],
    queryFn: () => apiGet<DeviceStatus>(`/api/agent/device/approve?code=${encodeURIComponent(userCode)}`),
    enabled: !!session?.user && userCode.length >= 8 && !decision,
    retry: false,
  });

  const decide = useMutation({
    mutationFn: (action: 'approve' | 'deny') =>
      apiPost('/api/agent/device/approve', { userCode, action }),
    onSuccess: (_data, action) => setDecision(action === 'approve' ? 'approved' : 'denied'),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!sessionLoading && !session?.user) {
    return (
      <Card className="mx-auto mt-10 max-w-md">
        <CardHeader>
          <CardTitle>{m['settings.device.title']()}</CardTitle>
          <CardDescription>{m['settings.device.signin_required']()}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/sign-in" className="text-sm font-medium underline underline-offset-4">
            {m['common.sign.sign_in_title']()}
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto mt-10 max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MonitorSmartphone className="size-5" />
          {m['settings.device.title']()}
        </CardTitle>
        <CardDescription>{m['settings.device.description']()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {decision === 'approved' ? (
          <p className="text-sm font-medium text-green-600">{m['settings.device.approved']()}</p>
        ) : decision === 'denied' ? (
          <p className="text-sm font-medium text-muted-foreground">{m['settings.device.denied']()}</p>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">{m['settings.device.code_label']()}</label>
              <Input
                value={userCode}
                onChange={(e) => setUserCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX"
                className="font-mono text-center text-lg tracking-widest"
              />
            </div>
            {statusQuery.isError && (
              <p className="text-sm text-destructive">{m['settings.device.invalid']()}</p>
            )}
            <div className="flex items-start gap-2 rounded-md border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>{m['settings.device.warning']()}</span>
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={!statusQuery.data || statusQuery.data.status !== 'pending' || decide.isPending}
                onClick={() => decide.mutate('approve')}
              >
                {m['settings.device.approve']()}
              </Button>
              <Button
                variant="outline"
                disabled={!statusQuery.data || statusQuery.data.status !== 'pending' || decide.isPending}
                onClick={() => decide.mutate('deny')}
              >
                {m['settings.device.deny']()}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export const Route = createFileRoute('/settings/device')({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === 'string' ? search.code : '',
  }),
  component: DeviceAuthPage,
});
