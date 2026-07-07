import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "react-oidc-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

import { oidcConfig } from "./auth/oidc-config";
import { setAuthToken } from "./api/admin-api";
import { useRoles } from "./auth/useRoles";

import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import UserDetail from "./pages/UserDetail";
import Roles from "./pages/Roles";
import Modules from "./pages/Modules";
import Templates from "./pages/Templates";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

// ─── Sincronizar token al API client ─────────────────────────────────────────

function TokenSyncer() {
  const { user } = useAuth();
  useEffect(() => {
    setAuthToken(user?.access_token ?? null);
  }, [user?.access_token]);
  return null;
}

// ─── Pantalla de sin acceso ───────────────────────────────────────────────────

function NoAccess() {
  const { signoutRedirect } = useAuth();
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm max-w-sm w-full p-8 text-center">
        <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Acceso denegado</h2>
        <p className="text-sm text-gray-500 mb-6">
          Tu cuenta no tiene los roles necesarios para acceder al Auth Manager.
          Contacta a un administrador para que te asigne el rol{" "}
          <code className="bg-gray-100 px-1 rounded text-xs">auth-manager-admin</code> o{" "}
          <code className="bg-gray-100 px-1 rounded text-xs">auth-manager-viewer</code>.
        </p>
        <button
          onClick={() => signoutRedirect()}
          className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

// ─── Pantalla de carga ────────────────────────────────────────────────────────

function LoadingScreen({ message = "Iniciando sesión..." }: { message?: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-gray-500">{message}</p>
      </div>
    </div>
  );
}

// ─── App con auth ─────────────────────────────────────────────────────────────

function AppContent() {
  const auth = useAuth();
  const { hasAccess } = useRoles();

  // Iniciar login automáticamente si no está autenticado
  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated && !auth.activeNavigator && !auth.error) {
      auth.signinRedirect();
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.activeNavigator, auth.error]);

  if (auth.isLoading || auth.activeNavigator) {
    return <LoadingScreen />;
  }

  if (auth.error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm max-w-sm w-full p-8 text-center">
          <p className="text-red-600 font-semibold mb-2">Error de autenticación</p>
          <p className="text-sm text-gray-500 mb-4">{auth.error.message}</p>
          <button
            onClick={() => auth.signinRedirect()}
            className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700"
          >
            Reintentar login
          </button>
        </div>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <LoadingScreen message="Redirigiendo a Keycloak..." />;
  }

  if (!hasAccess) {
    return <NoAccess />;
  }

  return (
    <>
      <TokenSyncer />
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/users" element={<Users />} />
          <Route path="/users/:id" element={<UserDetail />} />
          <Route path="/roles" element={<Roles />} />
          <Route path="/modules" element={<Modules />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider {...oidcConfig}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { borderRadius: "10px", fontSize: "13px" },
            success: { iconTheme: { primary: "#6366f1", secondary: "#fff" } },
          }}
        />
      </QueryClientProvider>
    </AuthProvider>
  );
}
