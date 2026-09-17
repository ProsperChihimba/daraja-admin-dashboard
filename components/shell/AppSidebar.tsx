"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { sidebarConfig, type NavGroup } from "@/config/sidebar";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * `groups` DEFAULTS TO THE ANKARA LIST, so `<AppSidebar />` renders exactly
 * what it rendered before this prop existed and app/(app)/layout.tsx is
 * untouched -- the same additive, default-inert shape used for Topbar's
 * onLogout/displayName/showSearch props.
 *
 * It exists because the two consoles have different navigation and one shared
 * list showed each of them the other's dead ends: an ops account (no Ankara
 * Redux session) was offered Organizations, Loans, Subscriptions, Support,
 * System and Audit Log, every one of which bounces through RequireAuth to
 * Ankara's /login (whole-branch review, I4). The Daraja layout passes
 * `darajaSidebarConfig`.
 */
export default function AppSidebar({
  groups = sidebarConfig,
}: {
  groups?: NavGroup[];
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="px-5 py-6">
        <div className="font-heading text-xl font-bold text-text">Ankara</div>
        <div className="text-xs text-text-muted">Control Center</div>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {groups.map((group) => (
          <div key={group.id}>
            <div className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-text-faint">
              {group.label}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-input px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-text hover:bg-secondary",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
