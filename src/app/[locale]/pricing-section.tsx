"use client";

import { Pricing, type PricingGroup } from "@/components/pricing";
import { useTranslations } from "next-intl";

export function PricingSection() {
  const t = useTranslations("landing");

  const groups: PricingGroup[] = [
    {
      key: "monthly",
      label: t("pricing.monthly"),
      plans: [
        {
          id: "starter-monthly",
          name: t("pricing.starter"),
          description: t("pricing.starter_desc"),
          price: "$9",
          interval: "mo",
          features: [
            t("pricing.feature_1_project"),
            t("pricing.feature_5k_credits"),
            t("pricing.feature_email_support"),
          ],
          productId: "starter_monthly",
          priceInCents: 900,
          currency: "usd",
          plan: { name: "Starter", interval: "month", intervalCount: 1 },
        },
        {
          id: "pro-monthly",
          name: t("pricing.pro"),
          description: t("pricing.pro_desc"),
          price: "$29",
          interval: "mo",
          featured: true,
          badge: t("pricing.popular"),
          features: [
            t("pricing.feature_unlimited_projects"),
            t("pricing.feature_50k_credits"),
            t("pricing.feature_priority_support"),
            t("pricing.feature_api_access"),
          ],
          productId: "pro_monthly",
          priceInCents: 2900,
          currency: "usd",
          plan: { name: "Pro", interval: "month", intervalCount: 1 },
        },
        {
          id: "enterprise-monthly",
          name: t("pricing.enterprise"),
          description: t("pricing.enterprise_desc"),
          price: "$99",
          interval: "mo",
          features: [
            t("pricing.feature_everything_pro"),
            t("pricing.feature_unlimited_credits"),
            t("pricing.feature_dedicated_support"),
            t("pricing.feature_custom_integrations"),
          ],
          productId: "enterprise_monthly",
          priceInCents: 9900,
          currency: "usd",
          plan: { name: "Enterprise", interval: "month", intervalCount: 1 },
        },
      ],
    },
  ];

  return <Pricing groups={groups} />;
}
