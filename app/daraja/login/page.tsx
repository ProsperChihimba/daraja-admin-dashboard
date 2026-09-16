// app/daraja/login/page.tsx
//
// Deliberately OUTSIDE the `app/(app)/` route group (the brief's file list
// said `app/(app)/daraja/login/page.tsx`, but `app/(app)/layout.tsx` wraps
// every page under that group in `RequireAuth`, which redirects to
// `/login` -- Ankara's own login -- whenever there is no *Ankara*
// superuser session, regardless of Daraja auth state. An ops account has
// no Ankara session at all, so the login form itself would never render.
// `app/login/page.tsx` (Ankara's login) already lives outside the group
// for the same reason; this mirrors that. The route group is invisible in
// the URL, so this still serves `/daraja/login` exactly as specified.
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { darajaLogin } from "@/lib/darajaAuth";

export default function DarajaLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await darajaLogin(identifier, password);
      router.push("/daraja/merchants");
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Sign in failed";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-16">
      <PageHeader title="Daraja Ops" subtitle="Sign in with your ops account" />
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="identifier">Username or email</Label>
          <Input id="identifier" value={identifier} autoComplete="username"
                 onChange={(e) => setIdentifier(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password}
                 autoComplete="current-password"
                 onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error ? <p className="text-sm text-danger-fg">{error}</p> : null}
        <Button type="submit" disabled={busy || !identifier || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
