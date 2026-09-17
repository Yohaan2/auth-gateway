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
  LayoutTemplate,
  Building2,
  ClipboardList,
  Sun,
  Moon,
} from "lucide-react";
import { useState } from "react";
import { useRoles } from "../auth/useRoles";
import { useIamAccess } from "../auth/useIamAccess";
import type { IamPermission } from "../api/admin-api";
import { useTheme } from "../theme/ThemeContext";

const NAV_ITEMS: { path: string; label: string; icon: typeof LayoutDashboard; permission?: IamPermission }[] = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/users", label: "Usuarios", icon: Users, permission: "iam:manage_users" },
  { path: "/roles", label: "Roles", icon: ShieldCheck, permission: "iam:manage_roles" },
  { path: "/modules", label: "Módulos", icon: AppWindow, permission: "iam:manage_settings" },
  { path: "/templates", label: "Plantillas de Acceso", icon: LayoutTemplate, permission: "iam:manage_templates" },
  { path: "/tenants", label: "Tenants", icon: Building2, permission: "iam:manage_tenants" },
  { path: "/audit-logs", label: "Auditoría", icon: ClipboardList, permission: "iam:view_audit" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, signoutRedirect } = useAuth();
  const { isAdmin, isViewer } = useRoles();
  const { hasPermission, isLoading: iamLoading } = useIamAccess();
  const { theme, toggleTheme } = useTheme();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.permission || iamLoading || hasPermission(item.permission)
  );

  const displayName =
    (user?.profile?.name as string) ||
    (user?.profile?.preferred_username as string) ||
    "Administrador";

  const sidebarWidth = sidebarExpanded ? "w-64" : "w-[4.25rem]";
  const mainMargin = sidebarExpanded ? "ml-64" : "ml-[4.25rem]";

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-950 flex overflow-hidden">
      <aside
        className={`fixed inset-y-0 left-0 z-30 ${sidebarWidth} bg-gray-900 text-white flex flex-col h-screen transition-[width] duration-200`}
      >
        <div
          className={`h-16 flex items-center border-b border-gray-700 shrink-0 ${
            sidebarExpanded ? "gap-3 px-5" : "justify-center px-0"
          }`}
        >
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Shield size={18} className="text-white" />
          </div>
          {sidebarExpanded && (
            <div className="min-w-0 overflow-hidden">
              <p className="font-semibold text-sm leading-tight truncate">Auth Manager</p>
              <p className="text-gray-400 text-xs truncate">optrax-realm</p>
            </div>
          )}
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-4 px-2 space-y-0.5">
          {visibleNavItems.map(({ path, label, icon: Icon }) => {
            const active =
              path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                title={!sidebarExpanded ? label : undefined}
                className={`flex items-center rounded-lg text-sm font-medium transition-colors ${
                  sidebarExpanded ? "gap-3 px-3 py-2.5" : "justify-center p-2.5"
                } ${
                  active
                    ? "bg-indigo-600 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <Icon size={18} className="flex-shrink-0" />
                {sidebarExpanded && (
                  <>
                    <span className="truncate">{label}</span>
                    {active && <ChevronRight size={14} className="ml-auto opacity-60 flex-shrink-0" />}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        <div className={`border-t border-gray-700 shrink-0 ${sidebarExpanded ? "p-4" : "p-2"}`}>
          <div className={`flex items-center ${sidebarExpanded ? "gap-3 mb-3" : "justify-center mb-2"}`}>
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-sm font-bold flex-shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
            {sidebarExpanded && (
              <div className="min-w-0 overflow-hidden">
                <p className="text-sm font-medium text-white truncate">{displayName}</p>
                <p className="text-xs text-gray-400 truncate">
                  {isAdmin ? "Administrador" : isViewer ? "Viewer" : "Sin rol"}
                </p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => signoutRedirect()}
            title="Cerrar sesión"
            className={`w-full flex items-center rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors ${
              sidebarExpanded ? "gap-2 px-3 py-2" : "justify-center p-2"
            }`}
          >
            <LogOut size={16} />
            {sidebarExpanded && "Cerrar sesión"}
          </button>
        </div>
      </aside>

      <div className={`flex-1 flex flex-col min-w-0 min-h-0 transition-[margin] duration-200 ${mainMargin}`}>
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setSidebarExpanded((e) => !e)}
            className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label={sidebarExpanded ? "Contraer menú" : "Expandir menú"}
            aria-expanded={sidebarExpanded}
          >
            <Menu size={20} />
          </button>
          <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
            <Shield size={14} className="text-white" />
          </div>
          <span className="font-semibold text-gray-900 dark:text-gray-100">Auth Manager</span>
          <button
            type="button"
            onClick={toggleTheme}
            className="ml-auto p-2 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            title={theme === "light" ? "Modo oscuro" : "Modo claro"}
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
