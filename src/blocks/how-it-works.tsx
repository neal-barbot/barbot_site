import { m } from '@/paraglide/messages.js';
import { tDynamic } from '@/core/i18n/dynamic';
import { FileSearch, ScanText, ClipboardCheck, type LucideIcon } from 'lucide-react';

const STEPS: { key: string; icon: LucideIcon }[] = [
  { key: 'step1', icon: FileSearch },
  { key: 'step2', icon: ScanText },
  { key: 'step3', icon: ClipboardCheck },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="px-4 py-24 sm:py-32 bg-muted/30">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-16">
          <h2 className="font-serif font-normal text-4xl sm:text-5xl tracking-tight">
            {m['landing.how.title']()}
          </h2>
          <p className="mt-5 text-muted-foreground max-w-lg mx-auto">
            {m['landing.how.description']()}
          </p>
        </div>
        <div className="grid gap-8 sm:grid-cols-3">
          {STEPS.map(({ key, icon: Icon }, index) => (
            <div key={key} className="relative flex flex-col items-center text-center gap-4">
              <div className="relative">
                <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-background border border-border shadow-sm">
                  <Icon className="size-6" strokeWidth={1.75} />
                </div>
                <span className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {index + 1}
                </span>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">{tDynamic(`landing.how.${key}.title`)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  {tDynamic(`landing.how.${key}.description`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
