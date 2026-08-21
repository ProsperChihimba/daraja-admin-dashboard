"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { sidebarConfig } from "@/config/sidebar";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="px-5 py-6">
        <div className="font-heading text-xl font-bold text-text">Ankara</div>
        <div className="text-xs text-text-muted">Control Center</div>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {sidebarConfig.map((group) => (
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
