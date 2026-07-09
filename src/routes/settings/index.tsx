import { createFileRoute } from '@tanstack/react-router';
import { SiteGptWorkspaceDashboard } from '@/components/sitegpt-console';

function DashboardPage() {
  return (
    <div className="min-h-full bg-white px-5 py-7 lg:px-7">
      <div className="mx-auto max-w-[1680px]">
        <SiteGptWorkspaceDashboard />
      </div>
    </div>
  );
}

export const Route = createFileRoute('/settings/')({
  component: DashboardPage,
});
