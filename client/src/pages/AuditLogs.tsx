import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditLogsApi, type AuditLogEntry } from "../api/admin-api";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

const PAGE_SIZE = 50;
const POLL_MS = 15_000;

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
      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
      : action.startsWith("delete") || action.startsWith("remove") || action.startsWith("revoke")
      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
      : action.startsWith("update") || action.startsWith("assign") || action.startsWith("sync") || action.startsWith("reapply") || action.startsWith("change")
      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
      : action.startsWith("enable") || action.startsWith("verify") || action.startsWith("send")
      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
      : action.startsWith("disable")
      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"
      : action.startsWith("gateway")
      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
      : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {action}
    </span>
  );
}

function EntityBadge({ entity }: { entity: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
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
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
      >
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {open ? "Ocultar" : "Ver detalle"}
      </button>
      {open && (
        <pre className="mt-1.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-2 overflow-auto max-w-xs max-h-48 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
          {JSON.stringify(detail, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function AuditLogs() {
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 500);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["audit-logs", page, search],
    queryFn: () =>
      auditLogsApi.list({
        first: page * PAGE_SIZE,
        max: PAGE_SIZE,
        search: search || undefined,
      }),
    refetchInterval: POLL_MS,
    staleTime: 15_000,
  });

  const logs: AuditLogEntry[] = data?.logs ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center">
            <ClipboardList size={18} className="text-indigo-600 dark:text-indigo-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Registro de Auditoría</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {total > 0 ? `${total.toLocaleString()} registros` : "Sin registros"}
              {isFetching && !isLoading && (
                <span className="ml-2 text-indigo-500 text-xs">Sincronizando…</span>
              )}
              <span className="ml-2 text-gray-400 text-xs">· auto cada {POLL_MS / 1000}s</span>
            </p>
          </div>
        </div>
      </div>

      <div className="relative max-w-xl">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(0);
          }}
          placeholder="Buscar por usuario, acción, entidad, ID..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <ClipboardList size={36} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">Sin registros de auditoría</p>
            {search && (
              <p className="text-xs mt-1">No hay coincidencias para &quot;{search}&quot;</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Acción</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Entidad</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">ID Entidad</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 font-mono">{formatDate(log.timestamp)}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate max-w-[160px]" title={log.actorSub}>
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Página {page + 1} de {totalPages} — {total.toLocaleString()} registros
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} />
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
