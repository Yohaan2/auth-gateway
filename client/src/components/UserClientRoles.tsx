import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { clientsApi, usersApi, type KcRole, type KcRoleMappings } from "../api/admin-api";
import RoleDualList from "./RoleDualList";

/**
 * Roles de módulo (cliente) de un usuario, p. ej. vstation → operator, tab-mapa.
 * Se elige el módulo y se asignan/quitan sus roles con la lista doble.
 */
export default function UserClientRoles({
  userId,
  mappings,
  onChanged,
}: {
  userId: string;
  mappings: KcRoleMappings | undefined;
  onChanged: () => void;
}) {
  const clientsQ = useQuery({ queryKey: ["clients"], queryFn: () => clientsApi.list() });
  const clients = useMemo(
    () => [...(clientsQ.data ?? [])].sort((a, b) => a.clientId.localeCompare(b.clientId)),
    [clientsQ.data],
  );
  const [clientUuid, setClientUuid] = useState("");

  // Por defecto vstation (el caso habitual); si no existe, el primer módulo.
  useEffect(() => {
    if (clientUuid || clients.length === 0) return;
    setClientUuid((clients.find((c) => c.clientId === "vstation") ?? clients[0]).id);
  }, [clients, clientUuid]);

  const rolesQ = useQuery({
    queryKey: ["client-roles", clientUuid],
    queryFn: () => clientsApi.getRoles(clientUuid),
    enabled: !!clientUuid,
  });

  const assignedByClient = Object.values(mappings?.clientMappings ?? {});
  const assigned = assignedByClient.find((m) => m.id === clientUuid)?.mappings ?? [];

  const handleChange = async (next: KcRole[]) => {
    const current = new Set(assigned.map((r) => r.id));
    const nextIds = new Set(next.map((r) => r.id));
    const toAdd = next.filter((r) => !current.has(r.id));
    const toRemove = assigned.filter((r) => !nextIds.has(r.id));
    try {
      if (toAdd.length) await usersApi.addClientRoles(userId, clientUuid, toAdd);
      if (toRemove.length) await usersApi.removeClientRoles(userId, clientUuid, toRemove);
      toast.success("Roles del módulo actualizados. Se aplican al volver a iniciar sesión.");
      onChanged();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error al actualizar roles del módulo.");
    }
  };

  return (
    <div className="space-y-3">
      {assignedByClient.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {assignedByClient.flatMap((m) =>
            m.mappings.map((r) => (
              <span key={`${m.id}:${r.id}`} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-2 py-0.5">
                {m.client} · {r.name}
              </span>
            )),
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-gray-700">Módulo</label>
        <select
          value={clientUuid}
          onChange={(e) => setClientUuid(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name ? `${c.name} (${c.clientId})` : c.clientId}
            </option>
          ))}
        </select>
      </div>
      {!clientUuid || rolesQ.isLoading ? (
        <p className="text-sm text-gray-400">Cargando roles...</p>
      ) : (rolesQ.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-gray-400">
          Este módulo no tiene roles. Créalos en Módulos → Roles.
        </p>
      ) : (
        <RoleDualList allRoles={rolesQ.data ?? []} assignedRoles={assigned} onChange={handleChange} />
      )}
    </div>
  );
}
