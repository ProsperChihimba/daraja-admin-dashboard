import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://ankara.getdaraja.com/api/v1";
const ACCESS = "daraja.admin.access";
const REFRESH = "daraja.admin.refresh";

export const getAdminAccess = () =>
  typeof window !== "undefined" ? localStorage.getItem(ACCESS) : null;

export function setAdminTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS, access);
  localStorage.setItem(REFRESH, refresh);
}
export function clearAdminTokens() {
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
}

const api = axios.create({
  baseURL: BASE,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAdminAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string> | null = null;
async function refreshAccess(): Promise<string> {
  const refresh = localStorage.getItem(REFRESH);
  if (!refresh) throw new Error("no refresh token");
  // Backend mounts SimpleJWT's TokenRefreshView at /api/v1/auth/refresh/.
  const { data } = await axios.post(`${BASE}/auth/refresh/`, { refresh });
  localStorage.setItem(ACCESS, data.access);
  if (data.refresh) localStorage.setItem(REFRESH, data.refresh); // if rotation is on
  return data.access;
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      try {
        refreshing = refreshing ?? refreshAccess();
        const access = await refreshing;
        refreshing = null;
        original.headers.Authorization = `Bearer ${access}`;
        return api(original);
      } catch {
        refreshing = null;
        clearAdminTokens();
        if (typeof window !== "undefined") window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export default api;
