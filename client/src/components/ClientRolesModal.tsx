import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Plus, Pencil, Trash2, CheckCircle, AlertTriangle, Wand2, Users } from "lucide-react";
import toast from "react-hot-toast";
import { clientsApi, type KcClient, type KcRole } from "../api/admin-api";
import ConfirmDialog from "./ConfirmDialog";

/**
 * Roles de un módulo (cliente de Keycloak): ver, crear, editar descripción y eliminar.
 * Para vstation muestra además qué roles necesita (acceso, nivel, pestañas) y crea los que falten.
 */
export default function ClientRolesModal({
  client,
  isAdmin,
  onClose,
}: {
  client: KcClient;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const rolesQ = useQuery({
    queryKey: ["client-roles", client.id],
    queryFn: () => clientsApi.getRoles(client.id),
  });
  const roles = [...(rolesQ.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  const [form, setForm] = useState<{ mode: "create" | "edit"; name: string; description: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<KcRole | null>(null);
  const [usersOf, setUsersOf] = useState<string | null>(null);

  const usersQ = useQuery({
    queryKey: ["client-role-users", client.id, usersOf],
    queryFn: () => clientsApi.getRoleUsers(client.id, usersOf!),
    enabled: !!usersOf,
  });

  const save = async () => {
    if (!form) return;
    const name = form.name.trim();
    if (!name) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      if (form.mode === "create") {
        await clientsApi.createRole(client.id, { name, description: form.description.trim() || undefined });
        toast.success(`Rol "${name}" creado.`);
      } else {
        await clientsApi.updateRole(client.id, name, { description: form.description.trim() });
        toast.success("Rol actualizado.");
      }
      setForm(null);
      rolesQ.refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error al guardar el rol.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (role: KcRole) => {
    try {
      await clientsApi.deleteRole(client.id, role.name);
      toast.success(`Rol "${role.name}" eliminado.`);
      rolesQ.refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error al eliminar el rol.");
    }
    setToDelete(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="ui-modal-panel w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Roles del módulo</h2>
            <p className="text-xs text-gray-500">{client.name || client.clientId} · {client.clientId}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto p-6 space-y-5 flex-1">
          <VstationPresetPanel clientId={client.clientId} isAdmin={isAdmin} onApplied={() => rolesQ.refetch()} />

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">{roles.length} roles</h3>
            {isAdmin && (
              <button
                onClick={() => setForm({ mode: "create", name: "", description: "" })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700"
              >
                <Plus size={14} /> Nuevo rol
              </button>
            )}
          </div>

          {form && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 dark:bg-indigo-900/20 dark:border-indigo-800 p-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={form.name}
                  disabled={form.mode === "edit"}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="nombre-del-rol"
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50"
                />
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Descripción (opcional)"
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setForm(null)} className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={save} disabled={saving} className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? "Guardando..." : form.mode === "create" ? "Crear" : "Guardar"}
                </button>
              </div>
            </div>
          )}

          {rolesQ.isLoading ? (
            <p className="text-sm text-gray-400">Cargando roles...</p>
          ) : roles.length === 0 ? (
            <p className="text-sm text-gray-400">Este módulo no tiene roles propios.</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
              {roles.map((role) => (
                <div key={role.id} className="px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{role.name}</p>
                      {role.description && <p className="text-xs text-gray-500 truncate">{role.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => setUsersOf(usersOf === role.name ? null : role.name)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                        title="Ver usuarios"
                      >
                        <Users size={14} />
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => setForm({ mode: "edit", name: role.name, description: role.description ?? "" })}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                            title="Editar descripción"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setToDelete(role)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {usersOf === role.name && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {usersQ.isLoading ? (
                        <span className="text-xs text-gray-400">Cargando usuarios...</span>
                      ) : (usersQ.data?.length ?? 0) === 0 ? (
                        <span className="text-xs text-gray-400">Sin usuarios con este rol (directo).</span>
                      ) : (
                        usersQ.data!.map((u) => (
                          <span key={u.id} className="text-xs bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5 text-gray-700">
                            {u.username}
                          </span>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar rol"
        message={`¿Eliminar el rol "${toDelete?.name}" de ${client.clientId}? Los usuarios y plantillas que lo tengan lo perderán.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={() => toDelete && remove(toDelete)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

const KIND_LABEL = { access: "Acceso (realm)", level: "Nivel de permisos", tab: "Pestañas" } as const;

/** Solo para el cliente de vstation: estado de los roles que vstation lee y botón para crear los que falten. */
function VstationPresetPanel({ clientId, isAdmin, onApplied }: { clientId: string; isAdmin: boolean; onApplied: () => void }) {
  const presetQ = useQuery({
    queryKey: ["vstation-preset"],
    queryFn: clientsApi.getVstationPreset,
    staleTime: 10_000,
  });
  const [applying, setApplying] = useState(false);
  const preset = presetQ.data;
  if (!preset || preset.clientId !== clientId) return null;

  const all = [...preset.realmRoles, ...preset.clientRoles];
  const apply = async () => {
    setApplying(true);
    try {
      const { created } = await clientsApi.applyVstationPreset();
      toast.success(created.length > 0 ? `Creados ${created.length} roles de vstation.` : "Ya estaban todos.");
      presetQ.refetch();
      onApplied();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error al crear los roles de vstation.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Roles que usa vstation</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Sin rol de nivel el usuario entra como Visualizador. Sin roles de pestaña ve todos los módulos;
            con alguno, solo esos. Los cambios se aplican al volver a iniciar sesión.
          </p>
        </div>
        {preset.missing === 0 ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full flex-shrink-0">
            <CheckCircle size={12} /> Completo
          </span>
        ) : (
          isAdmin && (
            <button
              onClick={apply}
              disabled={applying}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex-shrink-0"
            >
              <Wand2 size={14} /> {applying ? "Creando..." : `Crear ${preset.missing} que faltan`}
            </button>
          )
        )}
      </div>
      {(["access", "level", "tab"] as const).map((kind) => (
        <div key={kind}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">{KIND_LABEL[kind]}</p>
          <div className="flex flex-wrap gap-1.5">
            {all
              .filter((r) => r.kind === kind)
              .map((r) => (
                <span
                  key={r.name}
                  title={r.description}
                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                    r.exists
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {r.exists ? <CheckCircle size={10} /> : <AlertTriangle size={10} />}
                  {r.name}
                </span>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
