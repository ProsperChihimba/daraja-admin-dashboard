"use client";
import { useCallback, useEffect, useState } from "react";
import darajaApi, { clearOpsTokens, setOpsTokens } from "@/lib/darajaApi";
import type { DarajaAdminUser } from "@/types/daraja";

export async function darajaLogin(
  identifier: string,
  password: string,
): Promise<DarajaAdminUser> {
  const { data } = await darajaApi.post("/admin/auth/login/", {
    identifier,
    password,
  });
  setOpsTokens(data.access, data.refresh);
  return data.user as DarajaAdminUser;
}

export function darajaLogout() {
  clearOpsTokens();
  if (typeof window !== "undefined") window.location.href = "/daraja/login";
}

export async function darajaMe(): Promise<DarajaAdminUser> {
  const { data } = await darajaApi.get("/admin/me/");
  return data.user as DarajaAdminUser;
}

/** The Daraja twin of useAdminResource, on the Daraja client. */
export function useDarajaResource<T>(
  path: string,
  params?: Record<string, unknown>,
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? true;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(params ?? {});
  const refetch = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await darajaApi.get<T>(path, { params });
      setData(res.data);
    } catch (e) {
      // dashboard_exception_handler nests every raised DRF exception as
      // {error: {message, code, fields}}. AdminLogin's 401, though, never
      // passes through that wrapper -- it's a bare Response, so its body
      // really is the flat {message}. Check the nested shape first, then
      // the flat one, before falling back to axios's own generic text.
      const body = (
        e as {
          response?: {
            data?: { error?: { message?: string }; message?: string };
          };
        }
      )?.response?.data;
      const message =
        body?.error?.message ??
        body?.message ??
        (e instanceof Error ? e.message : "Failed to load");
      setError(message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, enabled]);
  useEffect(() => {
    void refetch();
  }, [refetch]);
  return { data, loading, error, refetch };
}
