import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Bot, Coins, Cpu, CreditCard, KeyRound, LifeBuoy, User, Workflow } from 'lucide-react';
import { m } from '@/paraglide/messages.js';
import { envConfigs } from '@/config';
import { Link } from '@/core/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiGet, type PageResult } from '@/lib/api-client';

function BarbotHub() {
  const credits = useQuery({
    queryKey: ['hub-credits'],
    queryFn: () => apiGet<{ balance: number }>('/api/credits'),
    retry: false,
  });
  const compares = useQuery({
    queryKey: ['hub-compares'],
    queryFn: () =>
      apiGet<PageResult<unknown>>('/api/chip-compare/records?pageSize=1').then((d) => d.total),
    retry: false,
  });
  const chatbots = useQuery({
    queryKey: ['hub-chatbots'],
    queryFn: () =>
      apiGet<Array<unknown>>('/api/ai-support/chatbots').then((d) =>
        Array.isArray(d) ? d.length : 0
      ),
    retry: false,
  });

  const products = [
    {
      icon: Cpu,
      name: m['landing.products.chip_p2p.name'](),
      tagline: m['landing.products.chip_p2p.tagline'](),
      href: '/settings/compare-history',
      kpi: `${compares.data ?? '—'} ${m['console.hub.chip_kpi']()}`,
    },
    {
      icon: Bot,
      name: m['landing.products.ai_fae.name'](),
      tagline: m['landing.products.ai_fae.tagline'](),
      href: '/settings/ai-support',
      kpi: `${chatbots.data ?? '—'} ${m['console.hub.fae_kpi']()}`,
    },
    ...(envConfigs.harvey_url
      ? [{
          icon: Workflow,
          name: m['landing.products.harvey.name'](),
          tagline: m['landing.products.harvey.tagline'](),
          href: envConfigs.harvey_url,
          external: true,
          kpi: '',
        }]
      : []),
  ];

  const accountLinks = [
    { icon: User, label: m['settings.nav.profile'](), href: '/settings/profile' },
    { icon: CreditCard, label: m['console.hub.buy_credits'](), href: '/settings/billing' },
    { icon: KeyRound, label: 'API Keys', href: '/settings/apikeys' },
    { icon: LifeBuoy, label: 'Support', href: '/settings/tickets' },
  ];

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{m['console.hub.title']()}</h1>
          <p className="text-muted-foreground">{m['console.hub.description']()}</p>
        </div>
        <Card>
          <CardContent className="flex items-center gap-4 px-5 py-3">
            <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Coins className="size-4" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">{m['console.hub.credits']()}</p>
              <p className="text-xl font-bold tabular-nums">{credits.data?.balance ?? '—'}</p>
            </div>
            <Link href="/settings/billing">
              <Button size="sm" variant="outline">
                {m['console.hub.buy_credits']()}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {products.map(({ icon: Icon, name, tagline, href, kpi, external }: any, i: number) => (
          <Card
            key={name}
            style={{ ['--i' as string]: i }}
            className="anim-tile hover-lift sheen-host hover:border-foreground/20 hover:shadow-md"
          >
            <CardContent className="flex h-full flex-col gap-4 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-foreground text-background">
                    <Icon className="size-5" strokeWidth={1.75} />
                  </span>
                  <h2 className="text-xl font-semibold">{name}</h2>
                </div>
                <span className="text-sm text-muted-foreground">{kpi}</span>
              </div>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{tagline}</p>
              {external ? (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  <Button className="gap-1.5">
                    {m['console.hub.open']()}
                    <ArrowRight className="size-4" />
                  </Button>
                </a>
              ) : (
                <Link href={href}>
                  <Button className="gap-1.5">
                    {m['console.hub.open']()}
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {m['console.hub.account']()}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {accountLinks.map(({ icon: Icon, label, href }) => (
            <Link key={href} href={href}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardContent className="flex items-center gap-3 px-4 py-3">
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{label}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/settings/')({
  component: BarbotHub,
});
