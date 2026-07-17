import { Link } from "@/core/i18n/navigation";
import { m } from "@/paraglide/messages.js";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { DotPattern } from "@/components/ui/dot-pattern";
import { SunsetShader } from "@/components/hero-shader";
import { cn } from "@/lib/utils";
import { envConfigs } from "@/config";

export function Hero() {
  
  return (
    <section className="relative isolate flex flex-col items-center justify-center overflow-hidden px-4 pt-24 pb-20 sm:pt-40 sm:pb-32">
      <SunsetShader />
      <DotPattern
        className={cn(
          "[mask-image:radial-gradient(ellipse_at_center,white,transparent_75%)]",
          "text-foreground/15"
        )}
      />
      <div className="relative max-w-3xl text-center space-y-8">
        <p className="anim-settle text-xs tracking-[0.25em] uppercase text-muted-foreground">
          {envConfigs.app_name}
        </p>
        <h1 style={{ ['--stagger' as string]: 1 }} className="anim-settle font-serif font-normal text-5xl sm:text-6xl lg:text-7xl leading-[1.1] tracking-tight text-foreground">
          {m["landing.hero.headline"]()}
        </h1>
        <p style={{ ['--stagger' as string]: 2 }} className="anim-settle text-lg text-muted-foreground sm:text-xl max-w-2xl mx-auto leading-relaxed">
          {m["landing.hero.subheadline"]()}
        </p>

        <div style={{ ['--stagger' as string]: 3 }} className="anim-settle flex items-center justify-center gap-3 pt-4">
          <Link
            href="/settings"
            className={cn(
              buttonVariants({ size: "lg" }),
              "gap-2 rounded-full px-8 h-12"
            )}
          >
            {m["landing.hero.cta"]()}
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/#products"
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
