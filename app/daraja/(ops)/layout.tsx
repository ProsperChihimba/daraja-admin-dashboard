// app/daraja/(ops)/layout.tsx
//
// The Daraja twin of app/(app)/layout.tsx -- deliberately its own guard
// rather than a change to the shared RequireAuth. RequireAuth checks an
// Ankara Redux superuser session; a Daraja ops account has no such session
// (create_ops_user never touches Ankara's auth at all, confirmed live:
// signing in at /daraja/login stores valid Daraja tokens but RequireAuth
// still bounces to /login because there is no Ankara user). Loosening
// RequireAuth to also accept a Daraja session would widen the gate in front
// of every out-of-scope Ankara page for a console that will move real money
// in a later plan -- a duplicated, narrower guard is the safer trade.
//
// AppSidebar and Topbar are reused, not forked -- AppSidebar has no Ankara
// dependency at all. Topbar now takes optional onLogout/displayName/
// showSearch props (components/shell/Topbar.tsx) precisely so this layout
// can supply Daraja's own logout, the real ops user's name, and suppress
// the search box (it points at /search, an Ankara-gated page an ops
// account cannot reach) -- every prop defaults to Ankara's original
// behaviour, so app/(app)/layout.tsx's bare <Topbar /> is unaffected.
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import AppSidebar from "@/components/shell/AppSidebar";
import Topbar from "@/components/shell/Topbar";
import { LoadingBlock } from "@/components/common/PageStates";
import { getOpsAccess } from "@/lib/darajaApi";
import { darajaLogout, darajaMe } from "@/lib/darajaAuth";
import type { DarajaAdminUser } from "@/types/daraja";

function displayName(user: DarajaAdminUser): string {
  const full = `${user.first_name} ${user.last_name}`.trim();
  return full || user.phone || user.email || "Admin";
}

export default function DarajaOpsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = React.useState<DarajaAdminUser | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!getOpsAccess()) {
        router.replace("/daraja/login");
        return;
      }
      try {
        // Confirms the stored token still resolves to a real ops session --
        // darajaApi's own 401 interceptor already retries once via refresh
        // and clears/redirects on a hard failure, so this call either
        // succeeds after a transparent refresh or the redirect is already
        // under way by the time the catch below runs. Its result also
        // gives the Topbar a real display name instead of "Admin".
        const me = await darajaMe();
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) router.replace("/daraja/login");
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Nothing renders until the check resolves, so a protected screen never
  // flashes before the redirect fires.
  if (!user) return <LoadingBlock />;

  return (
    <div className="flex min-h-screen bg-bg">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onLogout={darajaLogout} displayName={displayName(user)} showSearch={false} />
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
