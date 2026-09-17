import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { auditApi, type AuditLogEntry } from "../api/admin-api";
import Table, { type Column } from "../components/Table";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

const PAGE_SIZE = 30;
const POLL_MS = 15_000;

export default function AuditLogs() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 500);
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["audit-logs", debouncedSearch, page],
    queryFn: () =>
      auditApi.list({
        search: debouncedSearch || undefined,
        first: (page - 1) * PAGE_SIZE,
        max: PAGE_SIZE,
      }),
    refetchInterval: POLL_MS,
  });

  const columns: Column<AuditLogEntry>[] = [
    {
      key: "timestamp",
      header: "Fecha",
      render: (row) =>
        new Date(row.timestamp).toLocaleString("es-MX", {
          dateStyle: "short",
          timeStyle: "medium",
        }),
    },
    {
      key: "actor",
      header: "Actor",
      render: (row) => (
        <div>
          <p className="text-gray-800 dark:text-gray-200">{row.actorEmail || row.actorSub}</p>
          {row.actorEmail && (
            <p className="text-xs text-gray-400 font-mono truncate max-w-[180px]">{row.actorSub}</p>
          )}
        </div>
      ),
    },
    { key: "action", header: "Acción", render: (row) => <code className="text-xs">{row.action}</code> },
    { key: "entity", header: "Entidad" },
    {
      key: "entityId",
      header: "ID",
      render: (row) => (
        <span className="font-mono text-xs text-gray-500 truncate max-w-[140px] inline-block">
          {row.entityId || "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Auditoría</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {data?.total !== undefined
            ? `${data.total} eventos — actualización automática cada ${POLL_MS / 1000}s`
            : "Cargando..."}
          {isFetching && !isLoading && (
            <span className="ml-2 text-indigo-500 text-xs">Sincronizando…</span>
          )}
        </p>
      </div>

      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Buscar acción, entidad, actor..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-gray-800 dark:text-gray-100"
        />
      </div>

      <Table
        columns={columns}
        data={data?.logs ?? []}
        keyField="id"
        loading={isLoading}
        total={data?.total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        emptyMessage="No hay registros de auditoría."
      />
    </div>
  );
}
