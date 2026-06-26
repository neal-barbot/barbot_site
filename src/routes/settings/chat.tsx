import { createFileRoute } from '@tanstack/react-router';
import { useSession } from '@/core/auth/client';
import { envConfigs } from '@/config';

function ChatPage() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center text-sm text-muted-foreground">
        Not signed in.
      </div>
    );
  }

  // The gateway sits behind caddy at /agent on the same origin.
  // It enforces workspace = u_<userId> — the user can only see their own workspace.
  const gatewayBase = typeof window !== 'undefined'
    ? `${window.location.origin}/agent`
    : envConfigs.pi_agent_web_url;

  return (
    <div className="h-[calc(100vh-4rem)] w-full overflow-hidden">
      <iframe
        src={`${gatewayBase}/`}
        title="Doc QA chat"
        className="h-full w-full border-0"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}

export const Route = createFileRoute('/settings/chat')({
  component: ChatPage,
});
