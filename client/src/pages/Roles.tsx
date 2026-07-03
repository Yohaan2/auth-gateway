import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Users, ChevronDown, ChevronUp } from "lucide-react";
import { rolesApi, type KcRole, type KcUser } from "../api/admin-api";
import ConfirmDialog from "../components/ConfirmDialog";
import { useRoles } from "../auth/useRoles";
import toast from "react-hot-toast";

function RoleFormModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: { name: string; description?: string };
  onSave: (name: string, description: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("El nombre es obligatorio."); return; }
    setLoading(true);
    try {
      await onSave(name.trim(), description.trim());
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error al guardar rol.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          {initial ? "Editar rol" : "Nuevo rol del Realm"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!!initial}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50"
              placeholder="mi-rol-personalizado"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              placeholder="Descripción opcional..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
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

function RoleRow({ role, isAdmin, onDeleted }: { role: KcRole; isAdmin: boolean; onDeleted: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const usersQ = useQuery({
    queryKey: ["role-users", role.name],
    queryFn: () => rolesApi.getUsers(role.name),
    enabled: expanded,
  });

  const handleUpdate = async (_name: string, description: string) => {
    await rolesApi.update(role.name, { description });
    toast.success("Rol actualizado.");
    onDeleted();
  };

  const handleDelete = async () => {
    try {
      await rolesApi.delete(role.name);
      toast.success("Rol eliminado.");
      onDeleted();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error al eliminar rol.");
    }
    setShowDelete(false);
  };

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-4 py-3 text-sm">
          <div>
            <p className="font-medium text-gray-900">{role.name}</p>
            {role.composite && (
              <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">Compuesto</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">{role.description || "—"}</td>
        <td className="px-4 py-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            <Users size={13} />
            Ver usuarios
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </td>
        <td className="px-4 py-3 text-right">
          {isAdmin && (
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={() => setShowEdit(true)}
                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="Editar"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => setShowDelete(true)}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Eliminar"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={4} className="px-4 pb-3">
            <div className="bg-gray-50 rounded-lg p-3">
              {usersQ.isLoading ? (
                <p className="text-xs text-gray-400">Cargando usuarios...</p>
              ) : (usersQ.data?.length ?? 0) === 0 ? (
                <p className="text-xs text-gray-400">Sin usuarios con este rol.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {usersQ.data?.map((u: KcUser) => (
                    <span key={u.id} className="text-xs bg-white border border-gray-200 rounded-full px-2.5 py-1 text-gray-700">
                      {u.username}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}

      {showEdit && (
        <RoleFormModal initial={{ name: role.name, description: role.description }} onSave={handleUpdate} onClose={() => setShowEdit(false)} />
      )}
      <ConfirmDialog
        open={showDelete}
        title="Eliminar rol"
        message={`¿Eliminar el rol "${role.name}"? Los usuarios que lo tengan asignado lo perderán.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </>
  );
}

export default function Roles() {
  const { isAdmin } = useRoles();
  const [showCreate, setShowCreate] = useState(false);

  const { data: roles = [], isLoading, refetch } = useQuery({
    queryKey: ["realm-roles"],
    queryFn: rolesApi.list,
  });

  const handleCreate = async (name: string, description: string) => {
    await rolesApi.create({ name, description });
    toast.success("Rol creado.");
    refetch();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles del Realm</h1>
          <p className="text-sm text-gray-500 mt-0.5">{roles.length} roles configurados</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus size={16} />
            Nuevo rol
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Descripción</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Usuarios</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Cargando roles...</span>
                  </div>
                </td>
              </tr>
            ) : roles.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">
                  Sin roles configurados en el realm.
                </td>
              </tr>
            ) : (
              roles.map((role) => (
                <RoleRow key={role.id} role={role} isAdmin={isAdmin} onDeleted={refetch} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <RoleFormModal onSave={handleCreate} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}
