import { createFileRoute } from '@tanstack/react-router';
import { Header } from "@/blocks/header";
import { Hero } from "@/blocks/hero";
import { Features } from "@/blocks/features";
import { Pricing } from "@/blocks/pricing";
import { FAQ } from "@/blocks/faq";
import { Blog } from "@/blocks/blog";
import { CTA } from "@/blocks/cta";
import { Footer } from "@/blocks/footer";
import { SupportWidget } from "@/blocks/support-widget";
import { envConfigs } from "@/config";
import { getBlogPostsFn } from "@/content/posts/server";
import { m } from "@/paraglide/messages.js";
import { getLocale, locales, localizeUrl } from "@/paraglide/runtime.js";

/**
 * Default landing page — demo content. Rewrite this file (and the blocks in
 * src/blocks/) for your project. The primitives in src/components/ stay.
 * See /quick-start or /clone-website to automate the rewrite.
 */
function HomePage() {
  const { posts } = Route.useLoaderData();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />
      <main>
        <Hero />
        <Features />
        <Pricing />
        <FAQ />
        <Blog posts={posts} />
        <CTA />
      </main>
      <Footer />
      <SupportWidget />
    </div>
  );
}

export const Route = createFileRoute('/')({
  loader: async () => {
    const locale = getLocale();
    const posts = await getBlogPostsFn({ data: { locale, limit: 3 } });
    return { locale, posts };
  },
  head: ({ loaderData }) => {
    const locale = loaderData?.locale ?? 'en';
    const urlFor = (loc: string) =>
      localizeUrl(`${envConfigs.app_url}/`, { locale: loc as any }).href;
    return {
      meta: [
        {
          name: 'description',
          content: m['landing.hero.subheadline']({}, { locale: locale as any }),
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
  component: HomePage,
});
