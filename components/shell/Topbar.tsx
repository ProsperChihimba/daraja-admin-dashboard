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

export default function Topbar() {
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const [query, setQuery] = useState("");

  function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="flex h-14 items-center gap-4 border-b border-border-soft bg-surface px-4">
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

      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-input px-3 py-2 text-sm font-medium text-text hover:bg-secondary">
            <span>{user?.name ?? "Admin"}</span>
            <ChevronDown className="size-4 text-text-muted" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => adminLogout()}>
              <LogOut className="size-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
