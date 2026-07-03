import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus, Globe, Lock, CheckCircle, XCircle,
  Power, PowerOff, Tag, Pencil, X, Trash2
} from "lucide-react";
import { clientsApi, type KcClient, type KcRole } from "../api/admin-api";
import ConfirmDialog from "../components/ConfirmDialog";
import { useRoles } from "../auth/useRoles";
import toast from "react-hot-toast";

// ─── Modal Crear/Editar Client ─────────────────────────────────────────────

function ClientModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<KcClient>;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    clientId: initial?.clientId ?? "",
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    enabled: initial?.enabled ?? true,
    publicClient: initial?.publicClient ?? false,
    redirectUris: (initial?.redirectUris ?? []).join("\n"),
    webOrigins: (initial?.webOrigins ?? []).join("\n"),
  });
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId.trim()) { toast.error("El clientId es obligatorio."); return; }
    setLoading(true);
    try {
      await onSave({
        ...form,
        redirectUris: form.redirectUris.split("\n").map((s: string) => s.trim()).filter(Boolean),
        webOrigins: form.webOrigins.split("\n").map((s: string) => s.trim()).filter(Boolean),
      });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error al guardar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">{initial ? "Editar módulo" : "Nuevo módulo (Client)"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-3 flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Client ID *</label>
              <input type="text" value={form.clientId} onChange={(e) => set("clientId", e.target.value)}
                disabled={!!initial}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50"
                placeholder="mi-aplicacion" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombre amigable</label>
              <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Mi Aplicación" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
              rows={2} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              placeholder="Descripción opcional..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Redirect URIs (una por línea)</label>
            <textarea value={form.redirectUris} onChange={(e) => set("redirectUris", e.target.value)}
              rows={2} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none font-mono text-xs"
              placeholder="https://mi-app.com/*" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Web Origins (una por línea)</label>
            <textarea value={form.webOrigins} onChange={(e) => set("webOrigins", e.target.value)}
              rows={2} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none font-mono text-xs"
              placeholder="https://mi-app.com" />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.publicClient} onChange={(e) => set("publicClient", e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600" />
              Cliente público (SPA/mobile)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600" />
              Habilitado
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal roles del Client ────────────────────────────────────────────────

function ClientRolesModal({ client, onClose }: { client: KcClient; onClose: () => void }) {
  const [showNew, setShowNew] = useState(false);
  const [newRole, setNewRole] = useState({ name: "", description: "" });
  const [confirmDelete, setConfirmDelete] = useState<KcRole | null>(null);

  const { data: roles = [], refetch } = useQuery({
    queryKey: ["client-roles", client.id],
    queryFn: () => clientsApi.getRoles(client.id),
  });

  const handleCreate = async () => {
    if (!newRole.name.trim()) { toast.error("El nombre es obligatorio."); return; }
    try {
      await clientsApi.createRole(client.id, newRole);
      toast.success("Rol creado.");
      setNewRole({ name: "", description: "" });
      setShowNew(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error.");
    }
  };

  const handleDelete = async (role: KcRole) => {
    try {
      await clientsApi.deleteRole(client.id, role.name);
      toast.success("Rol eliminado.");
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error al eliminar.");
    }
    setConfirmDelete(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Roles de {client.name || client.clientId}</h2>
            <p className="text-xs text-gray-500">{roles.length} roles configurados</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
          {roles.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Sin roles para este módulo.</p>
          ) : (
            roles.map((role) => (
              <div key={role.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Tag size={14} className="text-indigo-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{role.name}</p>
                  {role.description && <p className="text-xs text-gray-400 truncate">{role.description}</p>}
                </div>
                <button onClick={() => setConfirmDelete(role)} className="p-1 text-gray-400 hover:text-red-600 rounded">
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="border-t p-4">
          {showNew ? (
            <div className="flex gap-2">
              <input type="text" value={newRole.name} onChange={(e) => setNewRole((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nombre del rol" className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              <input type="text" value={newRole.description} onChange={(e) => setNewRole((f) => ({ ...f, description: e.target.value }))}
                placeholder="Descripción" className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              <button onClick={handleCreate} className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">OK</button>
              <button onClick={() => setShowNew(false)} className="px-3 py-2 text-gray-600 border border-gray-300 text-sm rounded-lg hover:bg-gray-50">✕</button>
            </div>
          ) : (
            <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
              <Plus size={15} /> Agregar rol
            </button>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar rol de cliente"
        message={`¿Eliminar el rol "${confirmDelete?.name}"?`}
        confirmLabel="Eliminar"
        danger
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────

export default function Modules() {
  const { isAdmin } = useRoles();
  const [showCreate, setShowCreate] = useState(false);
  const [editClient, setEditClient] = useState<KcClient | null>(null);
  const [rolesClient, setRolesClient] = useState<KcClient | null>(null);
  const [toggleConfirm, setToggleConfirm] = useState<KcClient | null>(null);

  const { data: clients = [], isLoading, refetch } = useQuery({
    queryKey: ["clients"],
    queryFn: () => clientsApi.list(),
  });

  const handleCreate = async (data: any) => {
    await clientsApi.create(data);
    toast.success("Módulo creado.");
    refetch();
  };

  const handleEdit = async (data: Partial<KcClient>) => {
    if (!editClient) return;
    await clientsApi.update(editClient.id, data);
    toast.success("Módulo actualizado.");
    refetch();
  };

  const handleToggle = async (client: KcClient) => {
    try {
      await clientsApi.update(client.id, { ...client, enabled: !client.enabled });
      toast.success(client.enabled ? "Módulo deshabilitado." : "Módulo habilitado.");
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error al cambiar estado.");
    }
    setToggleConfirm(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Módulos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {clients.length} aplicaciones registradas en el realm
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus size={16} />
            Nuevo módulo
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map((client) => (
            <div key={client.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${client.publicClient ? "bg-emerald-100" : "bg-indigo-100"}`}>
                    {client.publicClient ? (
                      <Globe size={18} className="text-emerald-700" />
                    ) : (
                      <Lock size={18} className="text-indigo-700" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {client.name || client.clientId}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{client.clientId}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${client.enabled ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                  {client.enabled ? <CheckCircle size={10} /> : <XCircle size={10} />}
                  {client.enabled ? "Activo" : "Off"}
                </span>
              </div>

              {client.description && (
                <p className="text-xs text-gray-500 line-clamp-2">{client.description}</p>
              )}

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${client.publicClient ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-indigo-200 bg-indigo-50 text-indigo-700"}`}>
                  {client.publicClient ? "Público" : "Confidencial"}
                </span>
                {client.protocol && (
                  <span className="text-xs px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-600">
                    {client.protocol}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 pt-1 border-t border-gray-100">
                <button
                  onClick={() => setRolesClient(client)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  <Tag size={12} />
                  Roles
                </button>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => setEditClient(client)}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setToggleConfirm(client)}
                      className={`p-1.5 rounded-lg transition-colors ${client.enabled ? "text-gray-400 hover:text-red-600 hover:bg-red-50" : "text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"}`}
                      title={client.enabled ? "Deshabilitar" : "Habilitar"}
                    >
                      {client.enabled ? <PowerOff size={14} /> : <Power size={14} />}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <ClientModal onSave={handleCreate} onClose={() => setShowCreate(false)} />}
      {editClient && <ClientModal initial={editClient} onSave={handleEdit} onClose={() => setEditClient(null)} />}
      {rolesClient && <ClientRolesModal client={rolesClient} onClose={() => setRolesClient(null)} />}

      <ConfirmDialog
        open={!!toggleConfirm}
        title={toggleConfirm?.enabled ? "Deshabilitar módulo" : "Habilitar módulo"}
        message={`¿${toggleConfirm?.enabled ? "Deshabilitar" : "Habilitar"} el módulo "${toggleConfirm?.name || toggleConfirm?.clientId}"?`}
        confirmLabel={toggleConfirm?.enabled ? "Deshabilitar" : "Habilitar"}
        danger={toggleConfirm?.enabled}
        onConfirm={() => toggleConfirm && handleToggle(toggleConfirm)}
        onCancel={() => setToggleConfirm(null)}
      />
    </div>
  );
}
