"use client";
import { useCallback, useEffect, useState } from "react";
import api from "@/lib/axiosInstance";

export function useAdminResource<T>(
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
    setLoading(true); setError(null);
    try { const res = await api.get<T>(path, { params }); setData(res.data); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, enabled]);
  useEffect(() => { void refetch(); }, [refetch]);
  return { data, loading, error, refetch };
}
