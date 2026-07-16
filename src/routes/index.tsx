import { createFileRoute } from '@tanstack/react-router';
import { envConfigs } from '@/config';
import { getLocale, locales, localizeUrl } from '@/paraglide/runtime.js';
import { m } from '@/paraglide/messages.js';
import { Header } from '@/blocks/header';
import { Hero } from '@/blocks/hero';
import { Features } from '@/blocks/features';
import { HowItWorks } from '@/blocks/how-it-works';
import { Pricing } from '@/blocks/pricing';
import { FAQ } from '@/blocks/faq';
import { CTA } from '@/blocks/cta';
import { Footer } from '@/blocks/footer';

function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}

export const Route = createFileRoute('/')({
  loader: () => {
    const locale = getLocale();
    return {
      locale,
      title: `${envConfigs.app_name} — ${m['landing.hero.headline']({}, { locale })}`,
      description: m['landing.hero.subheadline']({}, { locale }),
    };
  },
  head: ({ loaderData }) => {
    const locale = loaderData?.locale ?? 'en';
    const urlFor = (loc: string) =>
      localizeUrl(`${envConfigs.app_url}/`, { locale: loc as any }).href;
    return {
      meta: [
        { title: loaderData?.title ?? envConfigs.app_name },
        { name: 'description', content: loaderData?.description ?? '' },
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
  component: HomePage,
});
