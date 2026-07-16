import { Link } from "@/core/i18n/navigation";
import { m } from "@/paraglide/messages.js";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { DotPattern } from "@/components/ui/dot-pattern";
import { cn } from "@/lib/utils";
import { envConfigs } from "@/config";

export function Hero() {
  
  return (
    <section className="relative isolate flex flex-col items-center justify-center overflow-hidden px-4 pt-24 pb-20 sm:pt-40 sm:pb-32">
      <DotPattern
        className={cn(
          "[mask-image:radial-gradient(ellipse_at_center,white,transparent_75%)]",
          "text-foreground/15"
        )}
      />
      <div className="relative max-w-3xl text-center space-y-8">
        <p className="text-xs tracking-[0.25em] uppercase text-muted-foreground">
          {envConfigs.app_name}
        </p>
        <h1 className="font-serif font-normal text-5xl sm:text-6xl lg:text-7xl leading-[1.1] tracking-tight text-foreground">
          {m["landing.hero.headline"]()}
        </h1>
        <p className="text-lg text-muted-foreground sm:text-xl max-w-2xl mx-auto leading-relaxed">
          {m["landing.hero.subheadline"]()}
        </p>

        <div className="flex items-center justify-center gap-3 pt-4">
          <Link
            href="/compare"
            className={cn(
              buttonVariants({ size: "lg" }),
              "gap-2 rounded-full px-8 h-12"
            )}
          >
            {m["landing.hero.cta"]()}
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/chips"
            className={cn(
              buttonVariants({ size: "lg", variant: "outline" }),
              "gap-2 rounded-full px-8 h-12"
            )}
          >
            {m["landing.hero.secondary"]()}
          </Link>
        </div>
      </div>
    </section>
  );
}
