"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronDown, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useAppSelector } from "@/store/hooks";
import { adminLogout } from "@/lib/auth";

export interface TopbarProps {
  /** Called from the "Log out" menu item. Defaults to Ankara's own
   *  adminLogout() -- every existing call site keeps that behaviour
   *  untouched by simply not passing this. */
  onLogout?: () => void;
  /** Name shown in the account menu. Defaults to the Ankara Redux
   *  session's user.name (falling back to "Admin"), exactly as before,
   *  when omitted. A caller with its own session (Daraja) passes its own
   *  resolved name instead of this component reaching into that store. */
  displayName?: string;
  /** Whether the global search box renders. Defaults to true, Ankara's
   *  existing behaviour. It navigates to /search, an Ankara-gated page
   *  under app/(app)/ -- a caller whose session can't reach that page
   *  (Daraja) passes false rather than offer a dead end. */
  showSearch?: boolean;
}

export default function Topbar({ onLogout, displayName, showSearch = true }: TopbarProps = {}) {
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const [query, setQuery] = useState("");

  function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  const name = displayName ?? user?.name ?? "Admin";
  const logout = onLogout ?? adminLogout;

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-border-soft bg-surface px-4">
      {showSearch ? (
        <form onSubmit={handleSearch} className="w-full max-w-md">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-faint" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customers, loans, MFIs, transactions…"
              className="pl-9"
            />
          </div>
        </form>
      ) : null}

      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-input px-3 py-2 text-sm font-medium text-text hover:bg-secondary">
            <span>{name}</span>
            <ChevronDown className="size-4 text-text-muted" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => logout()}>
              <LogOut className="size-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
