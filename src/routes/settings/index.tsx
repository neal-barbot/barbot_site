import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { SiteGptWorkspaceDashboard } from '@/components/sitegpt-console';
import { Link } from '@/core/i18n/navigation';
import { apiGet } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

function DashboardPage() {
  const chatbots = useQuery({
    queryKey: ['ai-chatbots'],
    queryFn: () => apiGet<Array<{ id: string; name: string }>>('/api/ai-support/chatbots'),
  });
  return (
    <div className="min-h-full bg-white px-5 py-7 lg:px-7">
      <div className="mx-auto max-w-[1680px]">
        {chatbots.data?.[0] && (
          <div className="mb-5 flex items-center justify-between rounded border border-blue-100 bg-blue-50 px-4 py-3">
            <span className="text-sm text-blue-900">Operating workspace: {chatbots.data[0].name}</span>
            <Link href={`/settings/chatbots/${chatbots.data[0].id}/`}>
              <Button size="sm">Open workspace</Button>
            </Link>
          </div>
        )}
        <SiteGptWorkspaceDashboard />
      </div>
    </div>
  );
}

export const Route = createFileRoute('/settings/')({
  component: DashboardPage,
});
