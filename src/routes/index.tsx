import { createFileRoute } from '@tanstack/react-router';
import { Copy, ExternalLink, PlayCircle, Plus } from 'lucide-react';
import { Link } from '@/core/i18n/navigation';
import { envConfigs } from '@/config';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import {
  SiteGptBrandMark,
  SiteGptFloatingActions,
  SiteGptTopBar,
} from '@/components/sitegpt-console';

function ChatbotCard() {
  return (
    <div className="flex h-[88px] items-center justify-between rounded-xl border border-slate-200 bg-white px-8 shadow-sm">
      <Link href="/settings" className="flex min-w-0 items-center gap-5">
        <SiteGptBrandMark />
        <span className="truncate text-lg font-bold text-slate-900">FAE</span>
      </Link>
      <div className="flex items-center gap-5 text-sm font-bold text-slate-500">
        <Link href="/settings/ai-support" className="inline-flex items-center gap-1.5 hover:text-blue-700">
          <ExternalLink className="size-4" />
          Chat Now
        </Link>
        <Link href="/settings/ai-support" className="inline-flex items-center gap-1.5 hover:text-blue-700">
          <Copy className="size-4" />
          Copy Embed
        </Link>
      </div>
    </div>
  );
}

function ChatbotsHome() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <SiteGptTopBar active="Chatbots" />
      <main className="mx-auto min-h-[calc(100vh-3rem)] max-w-[980px] px-6 py-9">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Chatbots</h1>
            <Link
              href="/settings/ai-support"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 hover:bg-blue-100"
            >
              <PlayCircle className="size-4" />
              Watch Video Tutorial
            </Link>
          </div>
          <Link
            href="/settings/ai-support"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700"
          >
            <Plus className="size-4" />
            Create New Chatbot
          </Link>
        </div>

        <section className="grid gap-4">
          <ChatbotCard />
        </section>
      </main>
      <SiteGptFloatingActions />
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
        { title: 'SiteGPT — Chatbots' },
        {
          name: 'description',
          content:
            'SiteGPT-style chatbot dashboard for creating, installing, and operating AI support chatbots.',
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
  component: ChatbotsHome,
});
