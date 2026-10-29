import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getAuthToken, setAuthToken } from "@/lib/api";

type User = {
  id: string;
  businessId: string;
  email: string;
  fullName: string;
  roles: string[];
  permissions: string[];
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (body: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    businessName: string;
    tradingName?: string;
    taxPin?: string;
    registrationNumber?: string;
    vatRegistered?: boolean;
    openingDate?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      api.me()
        .then(({ user: u }) => {
          setUser(u.user);
        })
        .catch(() => {
          setAuthToken(null);
          setUser(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const { user: u, token } = await api.login(email, password);
    setAuthToken(token);
    setUser(u.user);
  };

  const register = async (body: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    businessName: string;
    tradingName?: string;
    taxPin?: string;
    registrationNumber?: string;
    vatRegistered?: boolean;
    openingDate?: string;
  }) => {
    await api.register(body);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore errors on logout
    }
    setAuthToken(null);
    setUser(null);
  };

  const hasPermission = (permission: string) => {
    return user ? user.permissions.includes(permission) : false;
  };

  const hasAnyPermission = (permissions: string[]) => {
    return user ? permissions.some((p) => user.permissions.includes(p)) : false;
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    hasPermission,
    hasAnyPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
