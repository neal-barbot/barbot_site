import { createFileRoute, Outlet } from '@tanstack/react-router';
import { m } from "@/paraglide/messages.js";
import { LayoutDashboard, Users, Shield, KeyRound, DollarSign, CreditCard, Coins, FolderOpen, FileText, Settings, Home, Ticket, LifeBuoy } from "lucide-react";

import { AppLayout } from "@/components/app-layout";
import { envConfigs } from "@/config";

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
});

function AdminLayout() {
    
  const navItems = [
    { href: "/admin", label: m["admin.nav.overview"](), icon: LayoutDashboard, group: m["common.systems.admin"]() },
    { href: "/admin/users", label: m["admin.nav.users"](), icon: Users, group: m["admin.nav.rbac"]() },
    { href: "/admin/invite-codes", label: m["admin.nav.invite_codes"](), icon: Ticket, group: m["admin.nav.rbac"]() },
    { href: "/admin/roles", label: m["admin.nav.roles"](), icon: Shield, group: m["admin.nav.rbac"]() },
    { href: "/admin/permissions", label: m["admin.nav.permissions"](), icon: KeyRound, group: m["admin.nav.rbac"]() },
    { href: "/admin/categories", label: m["admin.nav.categories"](), icon: FolderOpen, group: m["admin.nav.content"]() },
    { href: "/admin/posts", label: m["admin.nav.posts"](), icon: FileText, group: m["admin.nav.content"]() },
    { href: "/admin/payments", label: m["admin.nav.payments"](), icon: DollarSign, group: m["admin.nav.billing"]() },
    { href: "/admin/subscriptions", label: m["admin.nav.subscriptions"](), icon: CreditCard, group: m["admin.nav.billing"]() },
    { href: "/admin/credits", label: m["admin.nav.credits"](), icon: Coins, group: m["admin.nav.billing"]() },
    { href: "/admin/tickets", label: m["admin.nav.tickets"](), icon: LifeBuoy, group: m["admin.nav.support"]() },
  ];

  const footerNavItems = [
    { href: "/admin/settings", label: m["admin.nav.settings"](), icon: Settings },
    { href: "/", label: m["common.systems.home"](), icon: Home, newTab: true },
  ];

  return (
    <AppLayout
      navItems={navItems}
      footerNavItems={footerNavItems}
      brand={envConfigs.app_name}
      brandHref="/admin"
      profileHref="/settings/profile"
      requirePermission="admin.*"
    >
      <Outlet />
    </AppLayout>
  );
}
