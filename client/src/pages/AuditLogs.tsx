import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditLogsApi, type AuditLogEntry } from "../api/admin-api";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const PAGE_SIZE = 50;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-ES", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function ActionBadge({ action }: { action: string }) {
  const color =
    action.startsWith("create") || action.startsWith("provision")
      ? "bg-green-100 text-green-700"
      : action.startsWith("delete") || action.startsWith("remove") || action.startsWith("revoke")
      ? "bg-red-100 text-red-700"
      : action.startsWith("update") || action.startsWith("assign") || action.startsWith("sync") || action.startsWith("reapply") || action.startsWith("change")
      ? "bg-blue-100 text-blue-700"
      : action.startsWith("enable") || action.startsWith("verify") || action.startsWith("send")
      ? "bg-indigo-100 text-indigo-700"
      : action.startsWith("disable")
      ? "bg-yellow-100 text-yellow-700"
      : action.startsWith("gateway")
      ? "bg-purple-100 text-purple-700"
      : "bg-gray-100 text-gray-600";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {action}
    </span>
  );
}

function EntityBadge({ entity }: { entity: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
      {entity}
    </span>
  );
}

function DetailExpander({ detail }: { detail: Record<string, unknown> | null }) {
  const [open, setOpen] = useState(false);
  if (!detail || Object.keys(detail).length === 0) {
    return <span className="text-gray-400 text-xs">—</span>;
  }
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
      >
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {open ? "Ocultar" : "Ver detalle"}
      </button>
      {open && (
        <pre className="mt-1.5 text-xs bg-gray-50 border border-gray-200 rounded p-2 overflow-auto max-w-xs max-h-48 text-gray-700 whitespace-pre-wrap">
          {JSON.stringify(detail, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function AuditLogs() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["audit-logs", page, search],
    queryFn: () =>
      auditLogsApi.list({
        first: page * PAGE_SIZE,
        max: PAGE_SIZE,
        search: search || undefined,
      }),
    staleTime: 15_000,
  });

  const logs: AuditLogEntry[] = data?.logs ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setPage(0);
      setSearch(searchInput.trim());
    },
    [searchInput]
  );

  const handleClear = () => {
    setSearchInput("");
    setSearch("");
    setPage(0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
            <ClipboardList size={18} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Registro de Auditoría</h1>
            <p className="text-sm text-gray-500">
              {total > 0 ? `${total.toLocaleString()} registros en total` : "Sin registros"}
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <form
        onSubmit={handleSearch}
        className="flex flex-col sm:flex-row gap-2"
      >
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por usuario, acción, entidad, ID..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Buscar
        </button>
        {search && (
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Limpiar
          </button>
        )}
      </form>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <ClipboardList size={36} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">Sin registros de auditoría</p>
            {search && (
              <p className="text-xs mt-1">No hay coincidencias para "{search}"</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Actor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Acción
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Entidad
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    ID Entidad
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Detalle
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 font-mono">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-gray-800 truncate max-w-[160px]" title={log.actorSub}>
                        {log.actorEmail || log.actorSub}
                      </div>
                      {log.actorEmail && (
                        <div className="text-xs text-gray-400 truncate max-w-[160px] font-mono" title={log.actorSub}>
                          {log.actorSub}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <EntityBadge entity={log.entity} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500 font-mono truncate block max-w-[120px]" title={log.entityId ?? ""}>
                        {log.entityId ?? <span className="text-gray-300">—</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <DetailExpander detail={log.detail} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Página {page + 1} de {totalPages} — {total.toLocaleString()} registros
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} />
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
