import { createFileRoute } from '@tanstack/react-router';
import { m } from '@/paraglide/messages.js';
import { Link } from '@/core/i18n/navigation';
import { ArrowRight, Bot, FileText, Headphones, UserCheck } from 'lucide-react';
import { Header } from '@/blocks/header';
import { Footer } from '@/blocks/footer';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function AiFaeProductPage() {
  const highlights = [
    { icon: FileText, text: () => m['landing.faq.formats.answer']() },
    { icon: UserCheck, text: () => m['landing.products.ai_fae.tagline']() },
    { icon: Headphones, text: () => m['landing.faq.accuracy.answer']() },
  ];
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="px-4 pt-24 pb-16 text-center sm:pt-32">
          <div className="mx-auto max-w-3xl space-y-6">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-foreground text-background">
              <Bot className="size-7" strokeWidth={1.75} />
            </span>
            <h1 className="font-serif text-5xl leading-[1.1] tracking-tight sm:text-6xl">
              {m['products.ai_fae.title']()}
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              {m['products.ai_fae.description']()}
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Link href="/settings/ai-support" className={cn(buttonVariants({ size: 'lg' }), 'gap-2 rounded-full px-8')}>
                {m['landing.products.ai_fae.cta']()}
                <ArrowRight className="size-4" />
              </Link>
              <Link href="/pricing" className={cn(buttonVariants({ size: 'lg', variant: 'outline' }), 'rounded-full px-8')}>
                {m['landing.nav.pricing']()}
              </Link>
            </div>
          </div>
        </section>
        <section className="px-4 pb-24">
          <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-3">
            {highlights.map(({ icon: Icon, text }, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-6">
                <Icon className="size-6 text-foreground/70" strokeWidth={1.75} />
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{text()}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

export const Route = createFileRoute('/products/ai-fae')({
  component: AiFaeProductPage,
});
