import { Link } from "@/core/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Zap, Shield, Globe, CreditCard } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { LandingHeader } from "@/components/landing-header";
import { LandingFooter, type FooterColumn } from "@/components/landing-footer";
import { PricingSection } from "./pricing-section";
import { cn } from "@/lib/utils";
import { envConfigs } from "@/config";

/**
 * Default landing page — showcases the built-in components.
 *
 * Replace or customize with:
 *   /quick-start <your product description>
 */
export default async function HomePage() {
  const t = await getTranslations("landing");

  const navLinks = [
    { href: "#features", label: t("nav.features") },
    { href: "#pricing", label: t("nav.pricing") },
  ];

  const features = [
    { icon: Zap, title: t("features.auth.title"), description: t("features.auth.description") },
    { icon: CreditCard, title: t("features.payment.title"), description: t("features.payment.description") },
    { icon: Shield, title: t("features.rbac.title"), description: t("features.rbac.description") },
    { icon: Globe, title: t("features.i18n.title"), description: t("features.i18n.description") },
  ];

  const footerColumns: FooterColumn[] = [
    {
      title: t("footer.product"),
      links: [
        { label: t("nav.features"), href: "#features" },
        { label: t("nav.pricing"), href: "#pricing" },
      ],
    },
    {
      title: t("footer.legal"),
      links: [
        { label: t("footer.privacy"), href: "/privacy-policy" },
        { label: t("footer.terms"), href: "/terms-of-service" },
      ],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <LandingHeader navLinks={navLinks} />

      {/* Hero */}
      <section className="flex items-center justify-center px-4 py-24 sm:py-32">
        <div className="max-w-2xl text-center space-y-6">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            {envConfigs.app_name}
          </h1>
          <p className="text-lg text-muted-foreground sm:text-xl">
            {envConfigs.app_description}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className={cn(buttonVariants({ size: "lg" }), "gap-2")}
            >
              {t("hero.cta")}
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              {t("hero.secondary")}
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("features.title")}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t("features.description")}
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="rounded-xl border border-border p-6 space-y-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="size-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("pricing.title")}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t("pricing.description")}
            </p>
          </div>
          <PricingSection />
        </div>
      </section>

      <LandingFooter columns={footerColumns} />
    </div>
  );
}
