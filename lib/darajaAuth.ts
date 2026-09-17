"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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

/**
 * The Daraja twin of useAdminResource, on the Daraja client.
 *
 * RETURNS `dataKey` AS WELL AS `data`, and callers that accumulate pages MUST
 * check it. `data` holds the PREVIOUS response until the next one lands --
 * the hook never clears it while loading, deliberately, so a table does not
 * blank out between pages. That means "data is present" does NOT mean "data
 * answers the request you are currently showing": a component that changes a
 * param and appends `data.results` appends the page it already had. That is
 * exactly how CursorList came to render page 1 twice on every "Load more"
 * click, in four money tables (whole-branch review, C1). `dataKey` is the
 * JSON of the params the held `data` was actually fetched for, so a caller
 * can compare it against the params it is asking for now and ignore a
 * response that belongs to an earlier request.
 *
 * It also guards STALE RESPONSES: each call takes a sequence number and a
 * response that resolves after a newer request was dispatched is dropped
 * rather than written over the newer one (out-of-order completion is
 * ordinary on a slow connection, and this hook has no AbortController).
 */
export function useDarajaResource<T>(
  path: string,
  params?: Record<string, unknown>,
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? true;
  // data and the key it was fetched for move together, in ONE state update:
  // two useStates would render once with the new data beside the old key.
  const [state, setState] = useState<{ data: T | null; key: string | null }>({
    data: null,
    key: null,
  });
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(params ?? {});
  const sequence = useRef(0);
  const refetch = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const seq = ++sequence.current;
    setLoading(true);
    setError(null);
    try {
      const res = await darajaApi.get<T>(path, { params });
      if (seq !== sequence.current) return;
      setState({ data: res.data, key });
    } catch (e) {
      if (seq !== sequence.current) return;
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
      if (seq === sequence.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, enabled]);
  useEffect(() => {
    void refetch();
  }, [refetch]);
  return { data: state.data, dataKey: state.key, loading, error, refetch };
}
