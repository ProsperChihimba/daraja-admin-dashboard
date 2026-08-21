import api, { setAdminTokens, clearAdminTokens, getAdminAccess } from "@/lib/axiosInstance";
import { store } from "@/store/store";
import { setAdminUser, clearAdmin, setHydrated } from "@/store/slices/authSlice";
import type { AdminUser } from "@/types/admin";

export async function adminLogin(email: string, password: string): Promise<AdminUser> {
  const { data } = await api.post("/admin/auth/login/", { email, password });
  setAdminTokens(data.access, data.refresh);
  const me = await api.get("/admin/me/");
  store.dispatch(setAdminUser(me.data as AdminUser));
  return me.data;
}

export function adminLogout() {
  clearAdminTokens();
  store.dispatch(clearAdmin());
  window.location.href = "/login";
}

export async function hydrateAdmin(): Promise<void> {
  if (!getAdminAccess()) { store.dispatch(setHydrated(true)); return; }
  try {
    const me = await api.get("/admin/me/");
    store.dispatch(setAdminUser(me.data as AdminUser));
  } catch { clearAdminTokens(); }
  finally { store.dispatch(setHydrated(true)); }
}
