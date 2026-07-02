import React, { createContext, useContext, useState, useEffect } from "react";
import { apiFetch } from "../../lib/api";

interface User {
  id: string;
  keycloakId: string;
  email: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const data = await apiFetch<{ authenticated: boolean; user?: User }>("/api/auth/me");
      if (data.authenticated && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      // Un error 401 significa que no está autenticado, lo manejamos con gracia
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = () => {
    setLoading(true);
    // Redirección completa del navegador al flujo de login de Keycloak
    window.location.href = "/api/auth/login";
  };

  const logout = () => {
    setLoading(true);
    // Redirección completa del navegador al endpoint de fin de sesión de Keycloak
    window.location.href = "/api/auth/logout";
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth debe ser utilizado dentro de un AuthProvider");
  }
  return context;
};
