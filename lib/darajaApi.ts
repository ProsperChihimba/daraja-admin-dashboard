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

/** Where the ops API lives.
 *
 * NEXT_PUBLIC_* IS COMPILED IN AT BUILD TIME, not read at runtime. If it is
 * unset when `next build` runs, the literal fallback below is baked into the
 * shipped JavaScript and no amount of configuring the web server afterwards
 * changes it.
 *
 * That is exactly how this broke on 2026-09-26: the value lives in .env.local,
 * which is not in git, so it never reached the deploy. The console at
 * adminops.getdaraja.com shipped calling http://localhost:8000 and every
 * request died as a CORS error -- a message that points at the allow-list,
 * which was not the problem.
 *
 * The fallback stays, because `npm run dev` with no env file should just work.
 * What is new is that it refuses to be SILENT: a bundle served from anywhere
 * other than localhost, pointing at localhost, is a misconfigured build, and
 * it now says so in the console on the first request instead of being
 * diagnosed from a CORS error three layers away. */
const LOCAL_FALLBACK = "http://localhost:8000/dashboard";
const BASE = process.env.NEXT_PUBLIC_DARAJA_API_BASE_URL ?? LOCAL_FALLBACK;

if (typeof window !== "undefined" && BASE === LOCAL_FALLBACK) {
  const host = window.location.hostname;
  if (host !== "localhost" && host !== "127.0.0.1" && !host.endsWith(".localhost")) {
    // Not a warning: nothing in this app can work from here.
    console.error(
      `[daraja-ops] MISCONFIGURED BUILD. This page is served from ${host} but ` +
        `the API base URL is ${LOCAL_FALLBACK} -- so every request goes to ` +
        `your own machine and fails. NEXT_PUBLIC_DARAJA_API_BASE_URL was not ` +
        `set when this bundle was BUILT; it is compiled in, so setting it on ` +
        `the server now will not help. Set it in the build environment (e.g. ` +
        `NEXT_PUBLIC_DARAJA_API_BASE_URL=https://backendapi.getdaraja.com/dashboard) ` +
        `and rebuild.`,
    );
  }
}
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
