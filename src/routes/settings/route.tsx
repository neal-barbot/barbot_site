import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router';
import { m } from "@/paraglide/messages.js";
import {
  BarChart3,
  Cpu,
  CreditCard as CreditCardIcon,
  Bot,
  Briefcase,
  ClipboardList,
  Code2,
  Database,
  Gauge,
  Globe2,
  Headphones,
  History,
  Home,
  Languages,
  LifeBuoy,
  Link2,
  MessageSquare,
  Palette,
  Settings,
  User,
  UserCircle,
  Users,
} from "lucide-react";

import { AppLayout } from "@/components/app-layout";
import { SupportWidget } from "@/blocks/support-widget";
import { SiteGptTopNavLinks } from "@/components/sitegpt-console";

export const Route = createFileRoute('/settings')({
  component: SettingsLayout,
});

function SettingsLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const chatbotId = /^\/settings\/chatbots\/([^/]+)/.exec(pathname)?.[1];
  const workspace = chatbotId ? `/settings/chatbots/${chatbotId}` : '/settings/ai-support';
  const workspaceGroup = undefined;
  const knowledgeGroup = "Knowledge Base";
  const customizationGroup = "Customizations";
  const advancedGroup = "Advanced";
  const navItems = [
    { href: chatbotId ? `${workspace}/` : "/settings", label: "Dashboard", icon: BarChart3, group: workspaceGroup },
    { href: `${workspace}/installation`, label: "Installation", icon: Briefcase, group: workspaceGroup },
    { href: `${workspace}/sdk`, label: "SDK (Advanced)", icon: Code2, group: workspaceGroup },
    { href: `${workspace}/history`, label: "Chat History", icon: History, group: workspaceGroup },
    { href: `${workspace}/leads`, label: "Leads", icon: UserCircle, group: workspaceGroup },
    { href: `${workspace}/knowledge/custom-responses`, label: "Custom Responses", icon: MessageSquare, group: knowledgeGroup },
    { href: `${workspace}/knowledge/text-snippets`, label: "Text Snippets", icon: Languages, group: knowledgeGroup },
    { href: `${workspace}/knowledge/website-links`, label: "Website Links", icon: Link2, group: knowledgeGroup },
    { href: `${workspace}/knowledge/files`, label: "Files & Data Sources", icon: Database, group: knowledgeGroup },
    { href: `${workspace}/knowledge/sync-jobs`, label: "Auto Sync Jobs", icon: Gauge, group: knowledgeGroup },
    { href: `${workspace}/customization/starters`, label: "Conversation Starters", icon: MessageSquare, group: customizationGroup },
    { href: `${workspace}/customization/followups`, label: "Conversation Followups", icon: MessageSquare, group: customizationGroup },
    { href: `${workspace}/customization/instructions`, label: "Chatbot Instructions", icon: Settings, group: customizationGroup },
    { href: `${workspace}/customization/persona`, label: "Chatbot Persona", icon: Bot, group: customizationGroup },
    { href: `${workspace}/customization/localization`, label: "Language & Region", icon: Globe2, group: customizationGroup },
    { href: `${workspace}/customization/appearance`, label: "Appearance", icon: Palette, group: customizationGroup },
    { href: `${workspace}/customization/human-support`, label: "Human Support", icon: Headphones, group: customizationGroup },
    { href: "/settings/profile", label: "Members", icon: Users, group: advancedGroup },
    { href: "/settings/apikeys", label: "Integrations", icon: Link2, group: advancedGroup },
    { href: `${workspace}/settings`, label: "Settings", icon: Settings, group: advancedGroup },
  ];

  const footerNavItems = [
    { href: "/settings/profile", label: m["settings.nav.profile"](), icon: User },
    { href: "/", label: m["common.systems.home"](), icon: Home, newTab: true },
  ];
  // ── Barbot area detection: fae workspace / chip workspace / account+hub ──
  const isFaeArea =
    !!chatbotId ||
    /^\/settings\/(ai-support|chat($|\/)|task-center|wiki-assistant)/.test(pathname);
  const isChipArea = /^\/settings\/(compare-history|chip-chat)/.test(pathname);

  const chipNavItems = [
    { href: "/settings", label: m["console.nav.hub"](), icon: Home, group: undefined },
    { href: "/settings/compare-history", label: m["settings.nav.compare_history"](), icon: History, group: m["console.nav.chip_group"]() },
    { href: "/settings/chip-chat", label: m["chat.nav"](), icon: MessageSquare, group: m["console.nav.chip_group"]() },
    { href: "/compare", label: m["console.nav.new_compare"](), icon: BarChart3, group: m["console.nav.chip_group"]() },
    { href: "/chips", label: m["console.nav.chip_catalog"](), icon: Database, group: m["console.nav.chip_group"]() },
  ];

  const accountNavItems = [
    { href: "/settings", label: m["console.nav.hub"](), icon: Home, group: undefined },
    { href: "/settings/profile", label: m["settings.nav.profile"](), icon: User, group: m["console.nav.account_group"]() },
    { href: "/settings/billing", label: "Billing", icon: CreditCardIcon, group: m["console.nav.account_group"]() },
    { href: "/settings/credits", label: "Credits", icon: Gauge, group: m["console.nav.account_group"]() },
    { href: "/settings/payments", label: "Payments", icon: ClipboardList, group: m["console.nav.account_group"]() },
    { href: "/settings/apikeys", label: "API Keys", icon: Link2, group: m["console.nav.account_group"]() },
    { href: "/settings/tickets", label: "Support", icon: LifeBuoy, group: m["console.nav.account_group"]() },
  ];

  const faeNavItems = chatbotId
    ? navItems
    : [
        { href: "/settings", label: m["console.nav.hub"](), icon: Home, group: undefined },
        ...navItems.filter((item) => item.label === 'Dashboard').map((i) => ({ ...i, href: '/settings/ai-support', label: 'FAE Dashboard' })),
        { href: '/settings/task-center', label: 'Task Center', icon: ClipboardList, group: workspaceGroup },
      ];

  const visibleNavItems = isFaeArea ? faeNavItems : isChipArea ? chipNavItems : accountNavItems;

  const headerExtra = isFaeArea ? <SiteGptTopNavLinks active="Chatbots" /> : undefined;

  const brand = isFaeArea ? (
    <span className="inline-flex items-center gap-2">
      <span className="grid size-7 place-items-center rounded-md bg-blue-600 text-white">
        <Bot className="size-4" />
      </span>
      <span>AI FAE</span>
    </span>
  ) : isChipArea ? (
    <span className="inline-flex items-center gap-2">
      <span className="grid size-7 place-items-center rounded-md bg-foreground text-background">
        <Cpu className="size-4" />
      </span>
      <span>Chip P2P</span>
    </span>
  ) : (
    <span className="font-serif text-lg font-semibold tracking-tight">Barbot</span>
  );

  return (
    <AppLayout
      navItems={visibleNavItems}
      footerNavItems={footerNavItems}
      brand={brand}
      brandHref="/settings"
      headerExtra={headerExtra}
    >
      <Outlet />
      <SupportWidget />
    </AppLayout>
  );
}
