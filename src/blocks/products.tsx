import { m } from '@/paraglide/messages.js';
import { Link } from '@/core/i18n/navigation';
import { ArrowRight, Bot, Cpu, Sparkles } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PRODUCTS = [
  {
    key: 'chip_p2p',
    icon: Cpu,
    href: '/products/chip-p2p',
    ctaHref: '/compare',
    name: () => m['landing.products.chip_p2p.name'](),
    tagline: () => m['landing.products.chip_p2p.tagline'](),
    cta: () => m['landing.products.chip_p2p.cta'](),
  },
  {
    key: 'ai_fae',
    icon: Bot,
    href: '/products/ai-fae',
    ctaHref: '/settings/ai-support',
    name: () => m['landing.products.ai_fae.name'](),
    tagline: () => m['landing.products.ai_fae.tagline'](),
    cta: () => m['landing.products.ai_fae.cta'](),
  },
] as const;

export function Products() {
  return (
    <section id="products" className="px-4 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <h2 className="font-serif text-4xl font-normal tracking-tight sm:text-5xl">
            {m['landing.products.title']()}
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-muted-foreground">
            {m['landing.products.description']()}
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {PRODUCTS.map(({ key, icon: Icon, href, ctaHref, name, tagline, cta }) => (
            <div
              key={key}
              className="group flex flex-col gap-5 rounded-2xl border border-border bg-card p-8 transition-all hover:border-foreground/20 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-foreground text-background">
                  <Icon className="size-5.5" strokeWidth={1.75} />
                </span>
                <h3 className="text-2xl font-semibold tracking-tight">{name()}</h3>
              </div>
              <p className="flex-1 leading-relaxed text-muted-foreground">{tagline()}</p>
              <div className="flex items-center gap-3">
                <Link href={ctaHref} className={cn(buttonVariants(), 'gap-1.5 rounded-full')}>
                  {cta()}
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href={href}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  {m['products.view_product']()}
                </Link>
              </div>
            </div>
          ))}
          <div className="flex flex-col gap-5 rounded-2xl border border-dashed border-border p-8 md:col-span-2">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-muted text-foreground/70">
                <Sparkles className="size-5.5" strokeWidth={1.75} />
              </span>
              <h3 className="text-xl font-semibold tracking-tight">
                {m['landing.products.coming.name']()}
              </h3>
            </div>
            <p className="leading-relaxed text-muted-foreground">
              {m['landing.products.coming.tagline']()}
            </p>
          </div>
        </div>
        <div className="mt-16 rounded-2xl bg-muted/40 px-8 py-10 text-center">
          <h3 className="font-serif text-2xl font-medium tracking-tight sm:text-3xl">
            {m['landing.credits.title']()}
          </h3>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            {m['landing.credits.description']()}
          </p>
        </div>
      </div>
    </section>
  );
}
