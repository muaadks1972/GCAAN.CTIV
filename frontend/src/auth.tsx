import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { storage } from "@/src/utils/storage";
import { api } from "@/src/api";

export type User = {
  id: string;
  username: string;
  full_name: string;
  role: "general_manager" | "department_manager" | "division_manager" | "employee";
  department_id?: string | null;
  division_id?: string | null;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const token = await storage.secureGet("gcaan_token", "");
      if (!token) {
        setUser(null);
        return;
      }
      const me = await api.get<User>("/auth/me");
      setUser(me);
    } catch {
      setUser(null);
      await storage.secureRemove("gcaan_token");
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const login = async (username: string, password: string) => {
    const res = await api.post<{ access_token: string; user: User }>("/auth/login", { username, password });
    await storage.secureSet("gcaan_token", res.access_token);
    setUser(res.user);
  };

  const logout = async () => {
    await storage.secureRemove("gcaan_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
