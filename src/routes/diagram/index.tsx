import { createFileRoute } from '@tanstack/react-router';
import { getLocale } from '@/paraglide/runtime.js';
import { m } from '@/paraglide/messages.js';
import { Header } from '@/blocks/header';
import { Footer } from '@/blocks/footer';
import { EeDiagramPanel } from '@/blocks/ee-diagram-panel';

function DiagramPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-10">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">
              {m['compare.diagram.page_title']()}
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              {m['compare.diagram.page_subtitle']()}
            </p>
          </div>
          <EeDiagramPanel />
        </div>
      </main>
      <Footer />
    </div>
  );
}

export const Route = createFileRoute('/diagram/')({
  loader: () => {
    const locale = getLocale();
    return { title: m['compare.diagram.page_title']({}, { locale }) };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: loaderData.title }] : [],
  }),
  component: DiagramPage,
});
