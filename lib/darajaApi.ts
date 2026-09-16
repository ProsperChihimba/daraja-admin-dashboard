/**
 * The Daraja ops API client.
 *
 * A SECOND axios instance, deliberately: lib/axiosInstance.ts belongs to the
 * Ankara integration and points at a different service with its own tokens.
 * Sharing one instance would mean one base URL and one token store for two
 * unrelated backends. Token keys are namespaced so a session on one never
 * authenticates the other.
 */
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const BASE =
  process.env.NEXT_PUBLIC_DARAJA_API_BASE_URL ?? "http://localhost:8000/dashboard";
const ACCESS = "daraja.ops.access";
const REFRESH = "daraja.ops.refresh";

export const getOpsAccess = () =>
  typeof window !== "undefined" ? localStorage.getItem(ACCESS) : null;

export function setOpsTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS, access);
  localStorage.setItem(REFRESH, refresh);
}

export function clearOpsTokens() {
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
}

const darajaApi = axios.create({
  baseURL: BASE,
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

darajaApi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getOpsAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string> | null = null;

async function refreshAccess(): Promise<string> {
  const refresh = localStorage.getItem(REFRESH);
  if (!refresh) throw new Error("no refresh token");
  const { data } = await axios.post(`${BASE}/admin/auth/refresh/`, { refresh });
  localStorage.setItem(ACCESS, data.access);
  return data.access;
}

darajaApi.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      try {
        refreshing = refreshing ?? refreshAccess();
        const access = await refreshing;
        refreshing = null;
        original.headers.Authorization = `Bearer ${access}`;
        return darajaApi(original);
      } catch {
        refreshing = null;
        clearOpsTokens();
        if (typeof window !== "undefined") window.location.href = "/daraja/login";
      }
    }
    return Promise.reject(error);
  },
);

export default darajaApi;
