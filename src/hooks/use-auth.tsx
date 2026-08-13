"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { clearRememberMe } from "@/lib/remember-me";
import type { PublicUser } from "@/types/user";

interface AuthState {
  user: PublicUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setUser: (user: PublicUser | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  refresh: async () => {},
  setUser: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: PublicUser }>("/api/auth/me");
      return data.user;
    } catch {
      return null;
    }
  }, []);

  const refresh = useCallback(async () => {
    const u = await fetchMe();
    setUser(u);
  }, [fetchMe]);

  const logout = useCallback(async () => {
    try {
      await apiFetch<{ success: boolean }>("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      clearRememberMe();
      setUser(null);
      router.push("/");
      router.refresh();
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchMe]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
