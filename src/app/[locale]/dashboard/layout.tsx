"use client";

import { useTranslations } from "next-intl";
import { LayoutDashboard, Settings, CreditCard, Key, Receipt, Coins, Home } from "lucide-react";
import { envConfigs } from "@/config";
import { AppLayout } from "@/components/app-layout";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations();

  const group = t("common.systems.dashboard");
  const navItems = [
    { href: "/dashboard", label: t("dashboard.nav.overview"), icon: LayoutDashboard, group },
    { href: "/dashboard/billing", label: t("dashboard.nav.billing"), icon: CreditCard, group },
    { href: "/dashboard/payments", label: t("dashboard.nav.payments"), icon: Receipt, group },
    { href: "/dashboard/credits", label: t("dashboard.nav.credits"), icon: Coins, group },
    { href: "/dashboard/apikeys", label: t("dashboard.nav.apikeys"), icon: Key, group },
  ];

  const footerNavItems = [
    { href: "/dashboard/settings", label: t("dashboard.nav.settings"), icon: Settings },
    { href: "/", label: t("dashboard.nav.home"), icon: Home, newTab: true },
  ];

  return (
    <AppLayout navItems={navItems} footerNavItems={footerNavItems} brand={envConfigs.app_name}>
      {children}
    </AppLayout>
  );
}
