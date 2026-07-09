import { createFileRoute, Outlet } from '@tanstack/react-router';
import { m } from "@/paraglide/messages.js";
import {
  BarChart3,
  Bot,
  Briefcase,
  Code2,
  CreditCard,
  Database,
  FileText,
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
import { Link } from "@/core/i18n/navigation";

export const Route = createFileRoute('/settings')({
  component: SettingsLayout,
});

function SettingsLayout() {
  const workspaceGroup = undefined;
  const knowledgeGroup = "Knowledge Base";
  const customizationGroup = "Customizations";
  const advancedGroup = "Advanced";
  const navItems = [
    { href: "/settings", label: "Dashboard", icon: BarChart3, group: workspaceGroup },
    { href: "/settings/ai-support", label: "Installation", icon: Briefcase, group: workspaceGroup },
    { href: "/settings/ai-support", label: "SDK (Advanced)", icon: Code2, group: workspaceGroup },
    { href: "/settings/chat", label: "Chat History", icon: History, group: workspaceGroup },
    { href: "/settings/tickets", label: "Leads", icon: UserCircle, group: workspaceGroup },
    { href: "/settings/ai-support", label: "Custom Responses", icon: MessageSquare, group: knowledgeGroup },
    { href: "/settings/ai-support", label: "Text Snippets", icon: Languages, group: knowledgeGroup },
    { href: "/settings/ai-support", label: "Website Links", icon: Link2, group: knowledgeGroup },
    { href: "/settings/ai-support", label: "Files & Data Sources", icon: Database, group: knowledgeGroup },
    { href: "/settings/ai-support", label: "Auto Sync Jobs", icon: Gauge, group: knowledgeGroup },
    { href: "/settings/ai-support", label: "Conversation Starters", icon: MessageSquare, group: customizationGroup },
    { href: "/settings/ai-support", label: "Conversation Followups", icon: MessageSquare, group: customizationGroup },
    { href: "/settings/ai-support", label: "Chatbot Instructions", icon: Settings, group: customizationGroup },
    { href: "/settings/ai-support", label: "Chatbot Persona", icon: Bot, group: customizationGroup },
    { href: "/settings/ai-support", label: "Language & Region", icon: Globe2, group: customizationGroup },
    { href: "/settings/ai-support", label: "Appearance", icon: Palette, group: customizationGroup },
    { href: "/settings/ai-support", label: "Human Support", icon: Headphones, group: customizationGroup },
    { href: "/settings/profile", label: "Members", icon: Users, group: advancedGroup },
    { href: "/settings/apikeys", label: "Integrations", icon: Link2, group: advancedGroup },
    { href: "/settings/profile", label: "Settings", icon: Settings, group: advancedGroup },
  ];

  const footerNavItems = [
    { href: "/settings/profile", label: m["settings.nav.profile"](), icon: User },
    { href: "/", label: m["common.systems.home"](), icon: Home, newTab: true },
  ];

  const headerExtra = (
    <nav className="hidden items-center gap-1 md:flex">
      {[
        { href: "/", label: "Chatbots", icon: Bot },
        { href: "/settings/ai-support", label: "Agents", icon: Briefcase },
        { href: "/settings/billing", label: "Billing", icon: CreditCard },
        { href: "/settings/ai-support", label: "Usage", icon: Gauge },
        { href: "/settings/profile", label: "Profile", icon: UserCircle },
        { href: "/blog", label: "Docs", icon: FileText },
        { href: "/settings/tickets", label: "Support", icon: Headphones },
        { href: "/settings/tickets", label: "Feedback", icon: MessageSquare },
      ].map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            href={item.href}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-slate-500 hover:bg-blue-50 hover:text-blue-700"
          >
            <Icon className="size-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <span className="inline-flex items-center gap-2">
      <span className="grid size-7 place-items-center rounded-md bg-blue-600 text-white">
        <Bot className="size-4" />
      </span>
      <span>SiteGPT</span>
    </span>
  );

  return (
    <AppLayout
      navItems={navItems}
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
