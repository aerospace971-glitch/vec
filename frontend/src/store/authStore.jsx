import { create } from "zustand";

const loadAuth = () => {
  try {
    return JSON.parse(localStorage.getItem("vec-auth")) || null;
  } catch {
    return null;
  }
};

const auth = loadAuth();

const useAuthStore = create((set) => ({
  user: auth?.user || null,
  token: auth?.token || "",
  setAuth: (payload) => {
    localStorage.setItem("vec-auth", JSON.stringify(payload));
    set({ user: payload.user, token: payload.token });
  },
  updateUser: (updates) => {
    set((state) => {
      const newUser = { ...state.user, ...updates };
      localStorage.setItem("vec-auth", JSON.stringify({ user: newUser, token: state.token }));
      return { user: newUser };
    });
  },
  clearAuth: async () => {
    // Fix 3: Invalidate token on server before clearing locally
    const stored = (() => { try { return JSON.parse(localStorage.getItem("vec-auth")); } catch { return null; } })();
    if (stored?.token) {
      try {
        await fetch("/auth/signout", {
          method: "POST",
          headers: { Authorization: `Bearer ${stored.token}` },
        });
      } catch (_) { /* server unreachable — clear locally anyway */ }
    }
    localStorage.removeItem("vec-auth");
    set({ user: null, token: "" });
  },
}));

export default useAuthStore;
