import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./features/auth/auth-context";
import { Shield, Lock, Unlock, Database, Key, CheckCircle, LogOut } from "lucide-react";
import { apiFetch } from "./lib/api";

function Dashboard() {
  const { user, logout } = useAuth();
  const [dbStatus, setDbStatus] = useState<string>("Verificando...");
  const [loadingHealth, setLoadingLoadingHealth] = useState(true);

  useEffect(() => {
    // Validar salud de la base de datos desde el endpoint de health
    apiFetch<{ database: string }>("/api/health")
      .then((res) => {
        setDbStatus(res.database === "connected" ? "Conectado" : "Desconectado");
      })
      .catch(() => {
        setDbStatus("Error al consultar");
      })
      .finally(() => {
        setLoadingLoadingHealth(false);
      });
  }, []);

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      {/* Cabecera del Dashboard */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl border border-emerald-100">
            <Unlock size={28} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-950">Área Protegida</h1>
            <p className="text-sm text-slate-500">Sesión activa e integrada con Keycloak y Postgres</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 transition-colors rounded-xl text-sm font-medium"
        >
          <LogOut size={16} />
          Cerrar Sesión
        </button>
      </div>

      {/* Grid de contenido */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Información del Usuario */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:col-span-2">
          <h2 className="text-base font-semibold text-slate-950 mb-4 flex items-center gap-2">
            <Shield className="text-indigo-600" size={18} />
            Perfil Sincronizado en Base de Datos
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-3 border-b border-slate-100 pb-3">
              <span className="text-sm text-slate-500 font-medium">Nombre</span>
              <span className="text-sm text-slate-900 col-span-2 font-semibold">
                {user?.name || "Sin nombre"}
              </span>
            </div>
            <div className="grid grid-cols-3 border-b border-slate-100 pb-3">
              <span className="text-sm text-slate-500 font-medium">Correo Electrónico</span>
              <span className="text-sm text-slate-900 col-span-2">{user?.email}</span>
            </div>
            <div className="grid grid-cols-3 border-b border-slate-100 pb-3">
              <span className="text-sm text-slate-500 font-medium">Keycloak ID (Sub)</span>
              <span className="text-sm text-slate-500 col-span-2 font-mono text-xs break-all bg-slate-50 p-1.5 rounded">
                {user?.keycloakId}
              </span>
            </div>
            <div className="grid grid-cols-3 border-b border-slate-100 pb-3">
              <span className="text-sm text-slate-500 font-medium">ID Interno (DB)</span>
              <span className="text-sm text-slate-500 col-span-2 font-mono text-xs break-all bg-slate-50 p-1.5 rounded">
                {user?.id}
              </span>
            </div>
            <div className="grid grid-cols-3">
              <span className="text-sm text-slate-500 font-medium">Sincronizado el</span>
              <span className="text-sm text-slate-900 col-span-2">
                {user?.createdAt ? new Date(user.createdAt).toLocaleString("es-ES") : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Estado de Integración de Servicios */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950 mb-4 flex items-center gap-2">
              <Database className="text-blue-600" size={18} />
              Infraestructura
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Keycloak OIDC</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <CheckCircle size={12} />
                  Activo
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">PostgreSQL App</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    dbStatus === "Conectado"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                      : "bg-amber-50 text-amber-700 border border-amber-100"
                  }`}
                >
                  <CheckCircle size={12} />
                  {dbStatus}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400">
            La sincronización de cuentas ocurre automáticamente al iniciar sesión a través de un flujo OIDC lazy provisioning.
          </div>
        </div>
      </div>
    </div>
  );
}

function WelcomeScreen() {
  const { login } = useAuth();
  
  // Capturar posibles errores de callback en la URL
  const [authError, setAuthError] = useState<string | null>(null);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth_error")) {
      setAuthError("No se pudo completar la autenticación con Keycloak. Por favor, revisa los logs del servidor.");
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-indigo-50 text-indigo-600 p-4 rounded-2xl border border-indigo-100 shadow-inner">
            <Shield size={40} />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-950 tracking-tight">
          Auth Optrax Scaffold
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500 max-w-sm mx-auto">
          Módulo base de autenticación federada integrado con Keycloak y PostgreSQL.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
          {authError && (
            <div className="mb-4 bg-rose-50 text-rose-700 text-xs border border-rose-100 rounded-xl p-3.5 leading-relaxed font-medium">
              ⚠️ {authError}
            </div>
          )}

          <div className="space-y-6">
            <div className="text-sm text-slate-600 space-y-4">
              <p>Este scaffold implementa el flujo de arquitectura requerido:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-500">
                <li><strong>Backend:</strong> Servidor Express sirviendo Vite como middleware.</li>
                <li><strong>Autenticación:</strong> Flujo seguro Authorization Code con Keycloak.</li>
                <li><strong>Base de Datos:</strong> Persistencia en PostgreSQL usando Drizzle ORM.</li>
                <li><strong>Proxy:</strong> Nginx enrutando el tráfico de desarrollo y producción.</li>
              </ul>
            </div>

            <button
              onClick={login}
              className="w-full flex justify-center items-center gap-2.5 px-4 py-3 border border-transparent text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Key size={18} />
              Iniciar Sesión con Keycloak
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MainApp() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600"></div>
        <span className="mt-4 text-sm text-slate-500 font-medium">Comprobando sesión...</span>
      </div>
    );
  }

  return isAuthenticated ? <Dashboard /> : <WelcomeScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-slate-50">
        <MainApp />
      </div>
    </AuthProvider>
  );
}
