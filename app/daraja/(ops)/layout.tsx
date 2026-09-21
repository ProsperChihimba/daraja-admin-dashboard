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
// AppSidebar and Topbar are reused, not forked. AppSidebar rendered the one
// shared `sidebarConfig`, so an ops account -- which by construction has no
// Ankara Redux session -- was shown Organizations, Subscriptions, Support,
// System and Audit Log, all of which enter app/(app)/, hit RequireAuth and
// bounce to Ankara's /login: a login form for a different service, inside the
// shell the operator was just using, which reads as an expired session rather
// than a wrong link (whole-branch review, I4). It now takes an optional
// `groups` prop, defaulting to `sidebarConfig`, and this layout passes
// `darajaSidebarConfig` -- app/(app)/layout.tsx's bare <AppSidebar /> is
// unchanged and renders the same list it always did.
// Topbar likewise takes optional onLogout/displayName/
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
import { darajaSidebarConfig } from "@/config/sidebar";
import { LoadingBlock } from "@/components/common/PageStates";
import { getOpsAccess } from "@/lib/darajaApi";
import { darajaLogout, darajaMe } from "@/lib/darajaAuth";
import { listActionRequests } from "@/lib/darajaActions";
import type { DarajaAdminUser } from "@/types/daraja";

function displayName(user: DarajaAdminUser): string {
  const full = `${user.first_name} ${user.last_name}`.trim();
  return full || user.phone || user.email || "Admin";
}

// How often the pending-actions badge re-polls. There is no server-side
// "how many are pending" aggregate (ActionRequests.get takes no state
// filter), so this reads one page of the queue (page_size at the
// paginator's own max -- DashboardPageNumberPagination.max_page_size=200)
// and counts PENDING, non-expired rows itself. Good enough for a nav badge;
// if pending requests ever exceed 200 at once this undercounts, which is a
// symptom worth noticing on its own.
const PENDING_POLL_MS = 30_000;

export default function DarajaOpsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = React.useState<DarajaAdminUser | null>(null);
  const [pendingCount, setPendingCount] = React.useState(0);

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

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function poll() {
      try {
        const page = await listActionRequests({ page: 1, page_size: 200 });
        if (cancelled) return;
        const pending = page.results.filter((r) => r.state === "pending" && !r.expired).length;
        setPendingCount(pending);
      } catch {
        // A badge that can't refresh stays at its last known value rather
        // than flashing an error in the nav -- the Actions screen itself
        // reports any real failure to load the queue.
      }
    }

    void poll();
    const id = setInterval(poll, PENDING_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user]);

  // Nothing renders until the check resolves, so a protected screen never
  // flashes before the redirect fires.
  if (!user) return <LoadingBlock />;

  return (
    <div className="flex min-h-screen bg-bg">
      <AppSidebar
        groups={darajaSidebarConfig}
        badges={{ "/daraja/actions": pendingCount }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onLogout={darajaLogout} displayName={displayName(user)} showSearch={false} />
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
