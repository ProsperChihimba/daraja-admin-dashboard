import api, { setAdminTokens, clearAdminTokens, getAdminAccess } from "@/lib/axiosInstance";
import { store } from "@/store/store";
import { setAdminUser, clearAdmin, setHydrated } from "@/store/slices/authSlice";
import type { AdminUser } from "@/types/admin";

/** Backend AdminUserSerializer returns {id, first_name, last_name, email, phone, is_superuser}
 *  — with no `name`. Normalize into the client's AdminUser shape. */
function normalizeAdminUser(raw: Record<string, unknown>): AdminUser {
  const first = (raw.first_name as string) ?? "";
  const last = (raw.last_name as string) ?? "";
  const name = `${first} ${last}`.trim() || (raw.phone as string) || (raw.email as string) || "Admin";
  return {
    id: String(raw.id),
    name,
    first_name: first,
    last_name: last,
    phone: raw.phone as string | undefined,
    email: (raw.email as string) ?? "",
    is_superuser: Boolean(raw.is_superuser),
  };
}

export async function adminLogin(email: string, password: string): Promise<AdminUser> {
  // Backend LoginSerializer expects `identifier` (email OR phone), not `email`.
  const { data } = await api.post("/admin/auth/login/", { identifier: email, password });
  setAdminTokens(data.access, data.refresh);
  // Login response already includes the user: { user, access, refresh }.
  const user = normalizeAdminUser(data.user);
  store.dispatch(setAdminUser(user));
  return user;
}

export function adminLogout() {
  clearAdminTokens();
  store.dispatch(clearAdmin());
  window.location.href = "/login";
}

export async function hydrateAdmin(): Promise<void> {
  if (!getAdminAccess()) { store.dispatch(setHydrated(true)); return; }
  try {
    // GET /admin/me/ returns { user: {...} }.
    const me = await api.get("/admin/me/");
    store.dispatch(setAdminUser(normalizeAdminUser(me.data.user)));
  } catch { clearAdminTokens(); }
  finally { store.dispatch(setHydrated(true)); }
}
