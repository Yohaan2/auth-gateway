import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Users, AppWindow, ShieldCheck, UserX, Clock } from "lucide-react";
import { dashboardApi, type KcUser } from "../api/admin-api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  to,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  to?: string;
}) {
  const content = (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{title}</p>
      </div>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

function formatDate(ts?: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("es-MX", { dateStyle: "medium" });
}

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: dashboardApi.getStats,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700 text-sm">
        Error al cargar el dashboard. Verifique la conexión con Keycloak.
      </div>
    );
  }

  const chartData = [
    { name: "Usuarios", total: data?.totalUsers ?? 0, disabled: data?.disabledUsers ?? 0 },
    { name: "Módulos", total: data?.totalModules ?? 0, disabled: 0 },
    { name: "Roles", total: data?.totalRealmRoles ?? 0, disabled: 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Resumen del realm optrax</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total de usuarios" value={data?.totalUsers ?? 0} icon={Users} color="bg-indigo-500" to="/users" />
        <StatCard title="Usuarios deshabilitados" value={data?.disabledUsers ?? 0} icon={UserX} color="bg-red-500" to="/users" />
        <StatCard title="Módulos registrados" value={data?.totalModules ?? 0} icon={AppWindow} color="bg-emerald-500" to="/modules" />
        <StatCard title="Roles del realm" value={data?.totalRealmRoles ?? 0} icon={ShieldCheck} color="bg-amber-500" to="/roles" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Resumen general</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barSize={36}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Bar dataKey="total" name="Total" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="disabled" name="Deshabilitados" fill="#f87171" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Usuarios recientes */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Usuarios recientes</h2>
            <Link to="/users" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
              Ver todos →
            </Link>
          </div>
          {data?.recentUsers?.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Sin usuarios registrados.</p>
          ) : (
            <div className="space-y-2">
              {data?.recentUsers?.map((u: KcUser) => (
                <Link
                  key={u.id}
                  to={`/users/${u.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-sm font-semibold flex-shrink-0">
                    {(u.firstName || u.username || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate group-hover:text-indigo-600">
                      {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.username}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{u.email || u.username}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Clock size={12} className="text-gray-300" />
                    <span className="text-xs text-gray-400">{formatDate(u.createdTimestamp)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
