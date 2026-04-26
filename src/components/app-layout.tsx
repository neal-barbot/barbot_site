"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/core/auth/client";
import { useRouter } from "@/core/i18n/navigation";
import { AppSidebar, type NavItem } from "@/components/app-sidebar";
import { UserMenu } from "@/components/user-menu";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export function AppLayout({
  children,
  navItems,
  footerNavItems,
  brand,
  brandHref = "/",
  mobileBrand,
  headerExtra,
  requirePermission,
  unauthorizedRedirect = "/dashboard",
}: {
  children: React.ReactNode;
  navItems: NavItem[];
  footerNavItems?: NavItem[];
  brand: React.ReactNode;
  brandHref?: string;
  mobileBrand?: React.ReactNode;
  headerExtra?: React.ReactNode;
  requirePermission?: string;
  unauthorizedRedirect?: string;
}) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (isPending) return;

    if (!session?.user) {
      setAuthorized(false);
      router.push("/sign-in");
      return;
    }

    fetch("/api/user/permissions")
      .then((r) => r.json())
      .then((res) => {
        const admin = res.code === 0 && res.data?.isAdmin === true;
        setIsAdmin(admin);
        if (requirePermission) {
          if (admin) {
            setAuthorized(true);
          } else {
            router.push(unauthorizedRedirect);
          }
        } else {
          setAuthorized(true);
        }
      })
      .catch(() => {
        if (requirePermission) {
          router.push(unauthorizedRedirect);
        } else {
          setAuthorized(true);
        }
      });
  }, [isPending, session, router, requirePermission, unauthorizedRedirect]);

  if (isPending || !authorized || !session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar
        brand={brand}
        brandHref={brandHref}
        navItems={navItems}
        footerNavItems={footerNavItems}
        isAdmin={isAdmin}
        footer={
          <UserMenu
            name={session.user.name || "User"}
            email={session.user.email}
            image={session.user.image}
          />
        }
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
          </div>
          <div className="flex-1" />
          {headerExtra && (
            <div className="flex items-center gap-1 px-4">{headerExtra}</div>
          )}
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
