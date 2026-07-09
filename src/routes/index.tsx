import { createFileRoute } from '@tanstack/react-router';
import {
  BarChart3,
  Bot,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  Code2,
  CreditCard,
  Database,
  FileText,
  Gauge,
  Globe2,
  Headphones,
  History,
  Languages,
  LifeBuoy,
  Link2,
  MessageSquare,
  Palette,
  Plus,
  Settings,
  Sparkles,
  UserCircle,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Link } from '@/core/i18n/navigation';
import { envConfigs } from '@/config';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';

const topNav = [
  { label: 'Chatbots', icon: Bot, href: '/' },
  { label: 'Agents', icon: Briefcase, href: '/settings/ai-support' },
  { label: 'Billing', icon: CreditCard, href: '/settings/billing' },
  { label: 'Usage', icon: Gauge, href: '/settings/ai-support' },
  { label: 'Profile', icon: UserCircle, href: '/settings/profile' },
  { label: 'Docs', icon: FileText, href: '/blog' },
  { label: 'Support', icon: Headphones, href: '/settings/tickets' },
  { label: 'Feedback', icon: MessageSquare, href: '/settings/tickets' },
];

type SidebarItem = {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  badge?: string;
};

const sidebarSections: Array<{ label?: string; items: SidebarItem[] }> = [
  {
    items: [
      { label: 'Dashboard', icon: BarChart3, active: true },
      { label: 'Installation', icon: Briefcase },
      { label: 'SDK (Advanced)', icon: Code2, badge: 'New' },
      { label: 'Chat History', icon: History },
      { label: 'Leads', icon: UserCircle },
    ],
  },
  {
    label: 'Knowledge Base',
    items: [
      { label: 'Custom Responses', icon: MessageSquare },
      { label: 'Text Snippets', icon: Languages },
      { label: 'Website Links', icon: Link2 },
      { label: 'Files & Data Sources', icon: Database },
      { label: 'Auto Sync Jobs', icon: Gauge, badge: 'New' },
    ],
  },
  {
    label: 'Customizations',
    items: [
      { label: 'Conversation Starters', icon: Sparkles },
      { label: 'Conversation Followups', icon: MessageSquare },
      { label: 'Chatbot Instructions', icon: Settings },
      { label: 'Chatbot Persona', icon: Bot },
      { label: 'Language & Region', icon: Globe2 },
      { label: 'Appearance', icon: Palette },
      { label: 'Human Support', icon: Headphones },
    ],
  },
  {
    label: 'Advanced',
    items: [
      { label: 'Members', icon: Users },
      { label: 'Integrations', icon: Link2 },
      { label: 'Settings', icon: Settings },
    ],
  },
];

const metrics = [
  { label: 'Total Links', value: '0', icon: Link2, dashed: true },
  { label: 'Total Files', value: '0', icon: Database, dashed: true },
  { label: 'Total Custom Responses', value: '0', icon: MessageSquare, dashed: true },
  { label: 'Total Messages', value: '0', icon: History },
  { label: 'Positive Feedback', value: '0%', icon: CheckCircle2, tone: 'green' },
  { label: 'Negative Feedback', value: '0%', icon: MessageSquare, tone: 'red' },
  { label: 'Total Pages Consumed', value: '0', icon: FileText },
];

function BrandMark() {
  return (
    <div className="grid size-7 place-items-center rounded-md bg-blue-600 text-white shadow-sm shadow-blue-500/20">
      <Bot className="size-4" />
    </div>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-slate-200 bg-white px-4">
      <Link href="/" className="flex items-center gap-2 text-slate-950">
        <BrandMark />
        <span className="text-xl font-bold leading-none">SiteGPT</span>
      </Link>
      <nav className="hidden items-center gap-1 md:flex">
        {topNav.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold ${
                item.label === 'Chatbots'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className="size-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <Link
        href="/settings/profile"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900"
      >
        <UserCircle className="size-4" />
        My Account
        <ChevronDown className="size-3.5" />
      </Link>
    </header>
  );
}

function WorkspaceSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white px-4 py-4 lg:block">
      <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
        <div className="truncate text-xs font-semibold text-slate-500">neal.liu@chatbarbot.com</div>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandMark />
            <span className="text-sm font-bold text-slate-900">FAE</span>
          </div>
          <ChevronDown className="size-4 text-slate-400" />
        </div>
      </div>

      <nav className="space-y-5">
        {sidebarSections.map((section, sectionIndex) => (
          <div key={section.label ?? sectionIndex}>
            {section.label && (
              <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                {section.label}
              </div>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.label === 'Human Support' ? '/settings/ai-support' : '/settings/ai-support'}
                    className={`flex min-h-8 items-center justify-between rounded-md px-2 text-sm font-semibold ${
                      item.active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-blue-700'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon className="size-4 shrink-0 text-current opacity-80" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge && (
                      <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

function MetricCard({
  metric,
}: {
  metric: (typeof metrics)[number];
}) {
  const Icon = metric.icon;
  const iconClass =
    metric.tone === 'green'
      ? 'bg-emerald-50 text-emerald-600'
      : metric.tone === 'red'
        ? 'bg-red-50 text-red-600'
        : 'bg-blue-50 text-blue-600';

  return (
    <div
      className={`min-h-24 rounded-lg border bg-white p-5 ${
        metric.dashed ? 'border-dashed border-blue-300' : 'border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`grid size-8 place-items-center rounded-full ${iconClass}`}>
            <Icon className="size-4" />
          </span>
          <div>
            <div className="text-sm font-bold text-slate-600">{metric.label}</div>
            <div className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{metric.value}</div>
          </div>
        </div>
        {metric.dashed && (
          <Link
            href="/settings/ai-support"
            className="inline-flex h-8 items-center gap-1 rounded-md bg-blue-600 px-3 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="size-3.5" />
            Add
          </Link>
        )}
      </div>
    </div>
  );
}

function DashboardHome() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <TopBar />
      <div className="flex min-h-[calc(100vh-3rem)]">
        <WorkspaceSidebar />
        <main className="min-w-0 flex-1 bg-white px-5 py-7 lg:px-7">
          <div className="mx-auto max-w-[1680px]">
            <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-950">Dashboard</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Manage chatbot knowledge, installation, leads, human support, and agent operations.
                </p>
              </div>
              <Link
                href="/settings/ai-support"
                className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
              >
                <Plus className="size-4" />
                Create New Chatbot
              </Link>
            </div>

            <section className="grid gap-5 xl:grid-cols-3">
              {metrics.slice(0, 3).map((metric) => (
                <MetricCard key={metric.label} metric={metric} />
              ))}
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-3">
              {metrics.slice(3, 6).map((metric) => (
                <MetricCard key={metric.label} metric={metric} />
              ))}
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-3">
              <div className="xl:col-span-1">
                <MetricCard metric={metrics[6]} />
              </div>
            </section>

            <section className="mt-8 border-t border-slate-200 pt-7">
              <h2 className="text-xl font-bold text-slate-950">Status & Preview</h2>
              <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start gap-4">
                  <div className="grid size-9 place-items-center rounded-md bg-white text-slate-500 ring-1 ring-slate-200">
                    <FileText className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-700">Your chatbot does not know anything yet.</div>
                    <p className="mt-1 text-sm text-slate-500">
                      Add links, files, or custom responses to train your chatbot and bring it to life.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {['Add Links', 'Add Files', 'Add Custom Responses'].map((label) => (
                        <Link
                          key={label}
                          href="/settings/ai-support"
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700"
                        >
                          <Plus className="size-3.5" />
                          {label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-8 border-t border-slate-200 pt-7">
              <h2 className="text-xl font-bold text-slate-950">Installation</h2>
              <div className="mt-5 grid gap-5">
                <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-5">
                  <div className="flex items-start gap-4">
                    <div className="grid size-9 place-items-center rounded-md bg-blue-600 text-white">
                      <Bot className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-blue-950">Chatbot ID</h3>
                      <p className="mt-1 text-sm text-blue-700">
                        This is your unique chatbot identifier. Use this ID when integrating with website plugins.
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <code className="rounded-md bg-blue-100 px-3 py-2 text-xs font-semibold text-blue-700">
                          e21c5114-3eae-4112-a27c-d2de504849a8
                        </code>
                        <span className="text-xs font-bold text-blue-700">Copy</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-5">
                  <div className="flex items-start gap-4">
                    <div className="grid size-9 place-items-center rounded-md bg-blue-600 text-white">
                      <Code2 className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-blue-950">Embed Code</h3>
                      <p className="mt-1 text-sm text-blue-700">
                        Copy this code and paste it in your website&apos;s HTML to embed your chatbot.
                      </p>
                      <pre className="mt-4 max-w-2xl overflow-x-auto rounded-md bg-blue-100 p-3 text-xs font-semibold leading-relaxed text-blue-700">
{`<script src="${envConfigs.app_url}/ai-support-widget.js"
  data-ai-support-public-key="pk_live_sitegpt_demo"
  async></script>`}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>

      <div className="fixed bottom-6 right-6 z-40 grid size-14 place-items-center rounded-full border border-slate-200 bg-white shadow-xl">
        <LifeBuoy className="size-6 text-slate-800" />
      </div>
      <div className="fixed right-0 top-1/2 z-40 hidden -translate-y-1/2 rounded-l-md bg-blue-600 px-2 py-4 text-xs font-bold text-white [writing-mode:vertical-rl] lg:block">
        Feedback
      </div>
    </div>
  );
}

export const Route = createFileRoute('/')({
  loader: () => ({ locale: getLocale() }),
  head: ({ loaderData }) => {
    const locale = loaderData?.locale ?? 'en';
    const urlFor = (loc: string) =>
      localizeUrl(`${envConfigs.app_url}/`, { locale: loc as any }).href;
    return {
      meta: [
        { title: 'SiteGPT — AI customer support dashboard' },
        {
          name: 'description',
          content:
            'SiteGPT-style AI customer support dashboard for chatbots, knowledge sources, leads, human support, and agent operations.',
        },
      ],
      links: [
        { rel: 'canonical', href: urlFor(locale) },
        ...locales.map((loc) => ({
          rel: 'alternate',
          hrefLang: loc,
          href: urlFor(loc),
        })),
        { rel: 'alternate', hrefLang: 'x-default', href: urlFor('en') },
      ],
    };
  },
  component: DashboardHome,
});
