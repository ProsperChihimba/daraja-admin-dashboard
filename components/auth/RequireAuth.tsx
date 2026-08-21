"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/store/hooks";
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, hydrated } = useAppSelector((s) => s.auth);
  useEffect(() => {
    if (hydrated && (!user || !user.is_superuser)) router.replace("/login");
  }, [hydrated, user, router]);
  if (!hydrated) return <div className="p-8 text-text-muted">Loading…</div>;
  if (!user || !user.is_superuser) return null;
  return <>{children}</>;
}
