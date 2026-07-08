import { Link, useLocation } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  AppWindow,
  LogOut,
  ChevronRight,
  Shield,
  Menu,
  X,
  LayoutTemplate,
  Building2,
} from "lucide-react";
import { useState } from "react";
import { useRoles } from "../auth/useRoles";
import { useIamAccess } from "../auth/useIamAccess";
import type { IamPermission } from "../api/admin-api";

const NAV_ITEMS: { path: string; label: string; icon: typeof LayoutDashboard; permission?: IamPermission }[] = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/users", label: "Usuarios", icon: Users, permission: "iam:manage_users" },
  { path: "/roles", label: "Roles", icon: ShieldCheck, permission: "iam:manage_roles" },
  { path: "/modules", label: "Módulos", icon: AppWindow, permission: "iam:manage_settings" },
  { path: "/templates", label: "Plantillas de Acceso", icon: LayoutTemplate, permission: "iam:manage_templates" },
  { path: "/tenants", label: "Tenants", icon: Building2, permission: "iam:manage_tenants" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, signoutRedirect } = useAuth();
  const { isAdmin, isViewer } = useRoles();
  const { hasPermission, isLoading: iamLoading } = useIamAccess();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Mientras se resuelven los permisos IAM, o si el usuario no tiene ningún
  // rol administrativo del IAM (p. ej. solo auth-manager-viewer legacy),
  // se muestran todos los ítems para no romper el flujo existente del panel.
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.permission || iamLoading || hasPermission(item.permission)
  );

  const displayName =
    (user?.profile?.name as string) ||
    (user?.profile?.preferred_username as string) ||
    "Administrador";

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Overlay móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-gray-900 text-white flex flex-col transform transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-gray-700">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-tight">Auth Manager</p>
            <p className="text-gray-400 text-xs">optrax-realm</p>
          </div>
          <button
            className="ml-auto lg:hidden text-gray-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-0.5">
          {visibleNavItems.map(({ path, label, icon: Icon }) => {
            const active =
              path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-indigo-600 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {label}
                {active && <ChevronRight size={14} className="ml-auto opacity-60" />}
              </Link>
            );
          })}
        </nav>

        {/* Usuario */}
        <div className="border-t border-gray-700 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-sm font-bold flex-shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{displayName}</p>
              <p className="text-xs text-gray-400 truncate">
                {isAdmin ? "Administrador" : isViewer ? "Viewer" : "Sin rol"}
              </p>
            </div>
          </div>
          <button
            onClick={() => signoutRedirect()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar móvil */}
        <header className="lg:hidden h-16 bg-white border-b flex items-center px-4 gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 hover:text-gray-900"
          >
            <Menu size={20} />
          </button>
          <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
            <Shield size={14} className="text-white" />
          </div>
          <span className="font-semibold text-gray-900">Auth Manager</span>
        </header>

        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
