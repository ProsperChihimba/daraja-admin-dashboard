import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AdminUser } from "@/types/admin";

interface AdminAuthState {
  user: AdminUser | null;
  hydrated: boolean;
  loading: boolean;
}

const initialState: AdminAuthState = {
  user: null,
  hydrated: false,
  loading: false,
};

const authSlice = createSlice({
  name: "adminAuth",
  initialState,
  reducers: {
    setAdminUser: (s, a: PayloadAction<AdminUser | null>) => {
      s.user = a.payload;
    },
    clearAdmin: (s) => {
      s.user = null;
    },
    setHydrated: (s, a: PayloadAction<boolean>) => {
      s.hydrated = a.payload;
    },
    setAuthLoading: (s, a: PayloadAction<boolean>) => {
      s.loading = a.payload;
    },
  },
});

export const { setAdminUser, clearAdmin, setHydrated, setAuthLoading } =
  authSlice.actions;
export const authReducer = authSlice.reducer;
