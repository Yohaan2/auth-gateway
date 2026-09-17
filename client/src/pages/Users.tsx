import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, ChevronRight, XCircle, Mail } from "lucide-react";
import { usersApi, type KcUser } from "../api/admin-api";
import Table, { type Column } from "../components/Table";
import CreateUserModal from "./modals/CreateUserModal";
import { useRoles } from "../auth/useRoles";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

const PAGE_SIZE = 20;

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        enabled ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
      }`}
    >
      {!enabled && <XCircle size={11} />}
      {enabled ? "Activo" : "Deshabilitado"}
    </span>
  );
}

export default function Users() {
  const { isAdmin } = useRoles();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [filterEnabled, setFilterEnabled] = useState<"" | "true" | "false">("");

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["users", debouncedSearch, page, filterEnabled],
    queryFn: () =>
      usersApi.list({
        search: debouncedSearch || undefined,
        first: (page - 1) * PAGE_SIZE,
        max: PAGE_SIZE,
        enabled: filterEnabled === "" ? undefined : filterEnabled === "true",
      }),
  });

  const columns: Column<KcUser>[] = [
    {
      key: "username",
      header: "Usuario",
      render: (u) => (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {(u.firstName || u.username || "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-gray-900">
              {u.firstName || u.lastName ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : u.username}
            </p>
            <p className="text-xs text-gray-400">{u.username}</p>
          </div>
        </div>
      ),
    },
    {
      key: "email",
      header: "Correo",
      render: (u) => (
        <div className="flex items-center gap-1.5">
          {u.email ? (
            <>
              <Mail size={13} className="text-gray-400" />
              <span className="text-gray-600">{u.email}</span>
              {u.emailVerified && (
                <span className="ml-1 text-emerald-500 text-xs" aria-label="Email verificado">✓</span>
              )}
            </>
          ) : (
            <span className="text-gray-400 text-xs">—</span>
          )}
        </div>
      ),
    },
    {
      key: "enabled",
      header: "Estado",
      render: (u) => <StatusBadge enabled={u.enabled} />,
    },
    {
      key: "createdTimestamp",
      header: "Creado",
      render: (u) =>
        u.createdTimestamp
          ? new Date(u.createdTimestamp).toLocaleDateString("es-MX", { dateStyle: "medium" })
          : "—",
    },
    {
      key: "actions",
      header: "",
      render: (u) => (
        <Link
          to={`/users/${u.id}`}
          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
        >
          Ver <ChevronRight size={12} />
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Usuarios</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {data?.total !== undefined ? `${data.total} usuarios en el realm` : "Cargando..."}
          {isFetching && !isLoading && <span className="ml-2 text-indigo-500 text-xs">Actualizando…</span>}
        </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus size={16} />
            Nuevo usuario
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por username, email o nombre..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <select
          value={filterEnabled}
          onChange={(e) => { setFilterEnabled(e.target.value as any); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-700 dark:text-gray-200"
        >
          <option value="">Todos los estados</option>
          <option value="true">Solo activos</option>
          <option value="false">Solo deshabilitados</option>
        </select>
      </div>

      <Table
        columns={columns}
        data={data?.users ?? []}
        keyField="id"
        loading={isLoading}
        total={data?.total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        emptyMessage="No se encontraron usuarios con los filtros aplicados."
      />

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refetch(); }}
        />
      )}
    </div>
  );
}
