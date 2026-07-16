import { createFileRoute } from '@tanstack/react-router';
import { Globe2, LineChart, Ruler } from 'lucide-react';

import { Footer } from '@/blocks/footer';
import { Header } from '@/blocks/header';
import { m } from '@/paraglide/messages.js';
import { getLocale } from '@/paraglide/runtime.js';

export const Route = createFileRoute('/industry')({
  loader: () => {
    const locale = getLocale();
    return {
      title: m['industry.meta.title']({}, { locale }),
      description: m['industry.meta.description']({}, { locale }),
    };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: loaderData.title },
          { name: 'description', content: loaderData.description },
        ]
      : [],
  }),
  component: IndustryPage,
});

interface SectionProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  paragraphs: string[];
}

function Section({ icon: Icon, title, paragraphs }: SectionProps) {
  return (
    <section className="border-t border-border py-14 first:border-t-0">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="mt-6 space-y-4">
        {paragraphs.map((text, i) => (
          <p key={i} className="leading-relaxed text-muted-foreground">
            {text}
          </p>
        ))}
      </div>
    </section>
  );
}

function IndustryPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-16">
          <div className="mb-4">
            <h1 className="text-4xl font-bold tracking-tight">
              {m['industry.hero.title']()}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              {m['industry.hero.subtitle']()}
            </p>
          </div>

          <Section
            icon={Globe2}
            title={m['industry.landscape.title']()}
            paragraphs={[
              m['industry.landscape.p1'](),
              m['industry.landscape.p2'](),
              m['industry.landscape.p3'](),
            ]}
          />
          <Section
            icon={LineChart}
            title={m['industry.trends.title']()}
            paragraphs={[
              m['industry.trends.p1'](),
              m['industry.trends.p2'](),
              m['industry.trends.p3'](),
            ]}
          />
          <Section
            icon={Ruler}
            title={m['industry.metrics.title']()}
            paragraphs={[
              m['industry.metrics.p1'](),
              m['industry.metrics.p2'](),
              m['industry.metrics.p3'](),
            ]}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}
