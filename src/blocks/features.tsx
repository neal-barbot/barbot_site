import { getTranslations } from "next-intl/server";
import {
  ShieldCheck,
  CreditCard,
  Users,
  Globe,
  FileText,
  Coins,
  type LucideIcon,
} from "lucide-react";

export async function Features() {
  const t = await getTranslations("landing");

  const features: { key: string; icon: LucideIcon }[] = [
    { key: "auth", icon: ShieldCheck },
    { key: "payment", icon: CreditCard },
    { key: "rbac", icon: Users },
    { key: "i18n", icon: Globe },
    { key: "cms", icon: FileText },
    { key: "credits", icon: Coins },
  ];

  return (
    <section id="features" className="px-4 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-20">
          <h2 className="font-serif font-normal text-4xl sm:text-5xl tracking-tight">
            {t("features.title")}
          </h2>
          <p className="mt-5 text-muted-foreground max-w-lg mx-auto">
            {t("features.description")}
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ key, icon: Icon }) => (
            <div
              key={key}
              className="group relative flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 transition-all hover:border-foreground/20 hover:shadow-sm"
            >
              <div className="inline-flex size-10 items-center justify-center rounded-xl bg-muted text-foreground/80 transition-colors group-hover:bg-foreground group-hover:text-background">
                <Icon className="size-5" strokeWidth={1.75} />
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">{t(`features.${key}.title`)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t(`features.${key}.description`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
