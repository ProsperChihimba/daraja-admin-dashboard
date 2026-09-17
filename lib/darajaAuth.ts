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
 * The identity of one request: BOTH the path and the params.
 *
 * WHY THE PATH IS IN HERE. This key used to be `JSON.stringify(params ?? {})`
 * -- the params ALONE. Two different paths asked with identical params
 * therefore produced the identical key, so a response fetched for one path
 * was indistinguishable from a response fetched for another. Under an
 * accumulating caller (useCursorPages, ActivityTab) that is not a cosmetic
 * collision, it is silent data corruption in three stages:
 *
 *   1. the already-advanced `cursor` is sent to the NEW path, asking the new
 *      result set to resume from a position taken in the old one, so page one
 *      of the new query is never fetched at all;
 *   2. the accumulated `rows` still hold the PREVIOUS path's records; and
 *   3. worst, the caller's `applied` set already contains that cursor's key
 *      and the key cannot tell the two paths apart, so the incoming response
 *      is recognised as "already folded in" and DISCARDED -- leaving the
 *      operator reading one query's rows under another query's controls, with
 *      no error and no empty state to hint at it.
 *
 * That was live, not theoretical: components/daraja/PeopleTab.tsx builds its
 * path from a dynamic-route `employerId`, and Next.js reuses a component
 * instance across same-route dynamic-segment navigation, so opening merchant
 * A and then merchant B kept A's employee rows on screen under B's name --
 * one merchant's staff list attributed to another merchant. The same shape
 * applied to every other `employerId`-derived tab (Wallet, Expenses, Cards,
 * Activity). Verified by executing the real components against both the
 * pre-fix and post-fix code (Task 9).
 *
 * MODULE-PRIVATE, DELIBERATELY. This was exported, and both accumulating
 * callers rebuilt their comparison key by calling it -- which put the
 * composition formula in three places at once. A future third consumer that
 * reconstructs it by hand instead, as the plausible `JSON.stringify({cursor})`,
 * would never match what the hook stores: its `page` would be null forever and
 * its list would show the EMPTY STATE PERMANENTLY WHILE EVERY REQUEST
 * SUCCEEDED -- silent, and indistinguishable from "this merchant has no rows"
 * (Task 9 review, Important 1). Callers are no longer handed the formula at
 * all; they ask the hook itself, via `isCurrent` below.
 */
function darajaDataKey(
  path: string,
  params?: Record<string, unknown>,
): string {
  return JSON.stringify([path, params ?? {}]);
}

/**
 * The Daraja twin of useAdminResource, on the Daraja client.
 *
 * RETURNS `isCurrent` AS WELL AS `data`, and callers that accumulate pages
 * MUST check it. `data` holds the PREVIOUS response until the next one lands
 * -- the hook never clears it while loading, deliberately, so a table does not
 * blank out between pages. That means "data is present" does NOT mean "data
 * answers the request you are currently showing": a component that changes a
 * param and appends `data.results` appends the page it already had. That is
 * exactly how CursorList came to render page 1 twice on every "Load more"
 * click, in four money tables (whole-branch review, C1).
 *
 * `isCurrent` answers that question and is the ONLY thing a caller should
 * gate on: it is true when the held `data` was fetched for exactly the path
 * AND params being asked for right now -- so a response belonging to an
 * earlier request is ignored whether it differed in its params or in its
 * path. The composition of the key stays inside this file (see above); a
 * caller that rebuilds it by hand can get it subtly wrong and then render an
 * empty list forever while its requests all return 200.
 *
 * `dataKey` is still returned, but ONLY as an opaque identity token for an
 * accumulator's already-applied set. Nothing outside this file composes,
 * parses or reconstructs it.
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
  const key = darajaDataKey(path, params);
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
  return {
    data: state.data,
    // Opaque identity token -- for an accumulator's applied-set only.
    dataKey: state.key,
    // "Is the response I am holding the one you are asking for?" -- computed
    // here, where the key's composition is known, so no call site has to
    // reproduce it.
    isCurrent: state.key === key,
    loading,
    error,
    refetch,
  };
}
