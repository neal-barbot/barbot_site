import { createFileRoute, Outlet } from '@tanstack/react-router';
import { m } from "@/paraglide/messages.js";
import { LayoutDashboard, User, CreditCard, Key, Receipt, Coins, Home, LifeBuoy, LibraryBig, MessageSquare, Bot } from "lucide-react";

import { AppLayout } from "@/components/app-layout";
import { SupportWidget } from "@/blocks/support-widget";
import { envConfigs } from "@/config";

export const Route = createFileRoute('/settings')({
  component: SettingsLayout,
});

function SettingsLayout() {
  
  const group = m["common.systems.settings"]();
  const navItems = [
    { href: "/settings", label: m["settings.nav.overview"](), icon: LayoutDashboard, group },
    { href: "/settings/billing", label: m["settings.nav.billing"](), icon: CreditCard, group },
    { href: "/settings/payments", label: m["settings.nav.payments"](), icon: Receipt, group },
    { href: "/settings/credits", label: m["settings.nav.credits"](), icon: Coins, group },
    { href: "/settings/ai-support", label: m["settings.nav.ai_support"](), icon: Bot, group },
    { href: "/settings/wiki-assistant", label: m["settings.nav.wiki_assistant"](), icon: LibraryBig, group },
    { href: "/settings/chat", label: "Doc QA", icon: MessageSquare, group },
    { href: "/settings/apikeys", label: m["settings.nav.apikeys"](), icon: Key, group },
    { href: "/settings/tickets", label: m["settings.nav.tickets"](), icon: LifeBuoy, group },
  ];

  const footerNavItems = [
    { href: "/settings/profile", label: m["settings.nav.profile"](), icon: User },
    { href: "/", label: m["common.systems.home"](), icon: Home, newTab: true },
  ];

  return (
    <AppLayout navItems={navItems} footerNavItems={footerNavItems} brand={envConfigs.app_name} brandHref="/settings">
      <Outlet />
      <SupportWidget />
    </AppLayout>
  );
}
