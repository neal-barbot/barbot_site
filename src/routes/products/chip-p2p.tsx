import { createFileRoute } from '@tanstack/react-router';
import { m } from '@/paraglide/messages.js';
import { Link } from '@/core/i18n/navigation';
import { ArrowRight } from 'lucide-react';
import { Header } from '@/blocks/header';
import { Footer } from '@/blocks/footer';
import { Features } from '@/blocks/features';
import { HowItWorks } from '@/blocks/how-it-works';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function ChipP2PProductPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="px-4 pt-24 pb-16 text-center sm:pt-32">
          <div className="mx-auto max-w-3xl space-y-6">
            <h1 className="font-serif text-5xl leading-[1.1] tracking-tight sm:text-6xl">
              {m['products.chip_p2p.title']()}
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              {m['products.chip_p2p.description']()}
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Link href="/compare" className={cn(buttonVariants({ size: 'lg' }), 'gap-2 rounded-full px-8')}>
                {m['landing.products.chip_p2p.cta']()}
                <ArrowRight className="size-4" />
              </Link>
              <Link href="/chips" className={cn(buttonVariants({ size: 'lg', variant: 'outline' }), 'rounded-full px-8')}>
                {m['chips.search.title']()}
              </Link>
            </div>
          </div>
        </section>
        <Features />
        <HowItWorks />
      </main>
      <Footer />
    </div>
  );
}

export const Route = createFileRoute('/products/chip-p2p')({
  component: ChipP2PProductPage,
});
