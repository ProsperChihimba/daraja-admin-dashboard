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
// dependency at all. Topbar does: it reads the Ankara Redux user for the
// display name (falls back to "Admin" for a Daraja-only session, no crash)
// and its "Log out" wires to Ankara's adminLogout(), which clears Ankara
// tokens/redux and hard-navigates to /login -- for an ops user that leaves
// the Daraja access/refresh tokens in localStorage untouched. Not patched
// here per instruction; flagged in the task report instead.
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import AppSidebar from "@/components/shell/AppSidebar";
import Topbar from "@/components/shell/Topbar";
import { LoadingBlock } from "@/components/common/PageStates";
import { getOpsAccess } from "@/lib/darajaApi";
import { darajaMe } from "@/lib/darajaAuth";

export default function DarajaOpsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = React.useState(false);

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
        // under way by the time the catch below runs.
        await darajaMe();
        if (!cancelled) setReady(true);
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
  if (!ready) return <LoadingBlock />;

  return (
    <div className="flex min-h-screen bg-bg">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
