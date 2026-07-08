import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  ChevronDown,
  ChevronUp,
  UserPlus,
  UserMinus,
  ArrowRightLeft,
  Building2,
  Search,
  X,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { tenantsApi, usersApi, type TenantView, type TenantMember, type KcUser } from "../api/admin-api";
import ConfirmDialog from "../components/ConfirmDialog";
import { useRoles } from "../auth/useRoles";

// ─── Modal: Crear / Editar Tenant ────────────────────────────────────────────

function TenantFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: TenantView;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("El nombre es obligatorio."); return; }
    setLoading(true);
    try {
      if (initial) {
        await tenantsApi.update(initial.id, { name: name.trim(), description: description.trim() });
        toast.success("Tenant actualizado.");
      } else {
        await tenantsApi.create({ name: name.trim(), description: description.trim() });
        toast.success("Tenant creado.");
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error al guardar tenant.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
        <h2 className="text-base font-semibold text-gray-900 mb-1">
          {initial ? "Editar tenant" : "Nuevo tenant"}
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Los usuarios se asignan directamente al grupo del tenant, sin sub-roles.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Empresa o cliente..."
              autoFocus
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
              {loading ? "Guardando..." : initial ? "Actualizar" : "Crear tenant"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Agregar miembro ───────────────────────────────────────────────────

function AddMemberModal({
  tenantId,
  tenantName,
  existingMemberIds,
  onClose,
  onAdded,
}: {
  tenantId: string;
  tenantName: string;
  existingMemberIds: Set<string>;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<KcUser | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as any).__addMemberTimer);
    (window as any).__addMemberTimer = setTimeout(() => setDebouncedSearch(v), 350);
  };

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["users-search-modal", debouncedSearch],
    queryFn: () => usersApi.list({ search: debouncedSearch || undefined, max: 10 }),
  });

  const availableUsers = (usersData?.users ?? []).filter((u) => !existingMemberIds.has(u.id));

  const handleAdd = async () => {
    if (!selectedUser) { toast.error("Selecciona un usuario."); return; }
    setLoading(true);
    try {
      await tenantsApi.addMember(tenantId, selectedUser.id);
      toast.success(`${selectedUser.username} agregado al tenant.`);
      onAdded();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error al agregar miembro.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Agregar miembro</h2>
        <p className="text-xs text-gray-500 mb-4">Tenant: <span className="font-medium">{tenantName}</span></p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Buscar usuario</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="username, email o nombre..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
            {usersLoading ? (
              <p className="p-3 text-xs text-gray-400 text-center">Buscando...</p>
            ) : availableUsers.length === 0 ? (
              <p className="p-3 text-xs text-gray-400 text-center">
                {debouncedSearch ? "Sin resultados." : "Escribe para buscar usuarios."}
              </p>
            ) : (
              availableUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    selectedUser?.id === u.id
                      ? "bg-indigo-50 border-l-2 border-indigo-500"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {(u.firstName || u.username || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.username}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{u.email ?? u.username}</p>
                  </div>
                  {selectedUser?.id === u.id && (
                    <CheckCircle2 size={16} className="text-indigo-500 flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button
              onClick={handleAdd}
              disabled={!selectedUser || loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <UserPlus size={14} />
              {loading ? "Agregando..." : "Agregar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Mover usuario a otro tenant ──────────────────────────────────────

function MoveTenantModal({
  member,
  currentTenantId,
  allTenants,
  onClose,
  onMoved,
}: {
  member: TenantMember;
  currentTenantId: string;
  allTenants: TenantView[];
  onClose: () => void;
  onMoved: () => void;
}) {
  const [targetTenantId, setTargetTenantId] = useState("");
  const [loading, setLoading] = useState(false);

  const displayName =
    member.firstName && member.lastName
      ? `${member.firstName} ${member.lastName}`
      : member.username;

  const otherTenants = allTenants.filter((t) => t.id !== currentTenantId);

  const handleMove = async () => {
    if (!targetTenantId) { toast.error("Selecciona un tenant destino."); return; }
    setLoading(true);
    try {
      await tenantsApi.moveMember(currentTenantId, member.id, targetTenantId);
      const targetName = allTenants.find((t) => t.id === targetTenantId)?.name ?? targetTenantId;
      toast.success(`${displayName} movido a "${targetName}".`);
      onMoved();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error al mover el usuario.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
        <div className="flex items-center gap-2 mb-1">
          <ArrowRightLeft size={16} className="text-indigo-500" />
          <h2 className="text-base font-semibold text-gray-900">Cambiar de tenant</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Usuario: <span className="font-medium">{displayName}</span>
        </p>

        {otherTenants.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No hay otros tenants disponibles.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {otherTenants.map((t) => (
              <button
                key={t.id}
                onClick={() => setTargetTenantId(t.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                  targetTenantId === t.id
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Building2 size={13} className="text-indigo-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800">{t.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{t.slug}</p>
                </div>
                {targetTenantId === t.id && (
                  <CheckCircle2 size={16} className="text-indigo-500 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          {otherTenants.length > 0 && (
            <button
              onClick={handleMove}
              disabled={!targetTenantId || loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <ArrowRightLeft size={14} />
              {loading ? "Moviendo..." : "Mover"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Fila de miembro ──────────────────────────────────────────────────────────

function MemberRow({
  member,
  tenantId,
  allTenants,
  isAdmin,
  onChanged,
}: {
  member: TenantMember;
  tenantId: string;
  allTenants: TenantView[];
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [showRemove, setShowRemove] = useState(false);
  const [showMove, setShowMove] = useState(false);

  const displayName =
    member.firstName && member.lastName
      ? `${member.firstName} ${member.lastName}`
      : member.username;

  const handleRemove = async () => {
    try {
      await tenantsApi.removeMember(tenantId, member.id);
      toast.success(`${member.username} removido del tenant.`);
      onChanged();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error al remover miembro.");
    }
    setShowRemove(false);
  };

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
              {(member.firstName || member.username || "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{displayName}</p>
              <p className="text-xs text-gray-400">{member.email ?? member.username}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${member.enabled ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {member.enabled ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
            {member.enabled ? "Activo" : "Deshabilitado"}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          {isAdmin && (
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={() => setShowMove(true)}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                title="Mover a otro tenant"
              >
                <ArrowRightLeft size={12} />
                Mover
              </button>
              <button
                onClick={() => setShowRemove(true)}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Remover del tenant"
              >
                <UserMinus size={14} />
              </button>
            </div>
          )}
        </td>
      </tr>

      {showMove && (
        <MoveTenantModal
          member={member}
          currentTenantId={tenantId}
          allTenants={allTenants}
          onClose={() => setShowMove(false)}
          onMoved={onChanged}
        />
      )}

      <ConfirmDialog
        open={showRemove}
        title="Remover miembro"
        message={`¿Remover a "${displayName}" del tenant?`}
        confirmLabel="Remover"
        danger
        onConfirm={handleRemove}
        onCancel={() => setShowRemove(false)}
      />
    </>
  );
}

// ─── Tarjeta de Tenant ────────────────────────────────────────────────────────

function TenantCard({
  tenant,
  allTenants,
  isAdmin,
  onEdit,
  onDeleted,
}: {
  tenant: TenantView;
  allTenants: TenantView[];
  isAdmin: boolean;
  onEdit: (t: TenantView) => void;
  onDeleted: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data: membersData, refetch: refetchMembers } = useQuery({
    queryKey: ["tenant-members", tenant.id],
    queryFn: () => tenantsApi.getMembers(tenant.id),
    enabled: expanded,
  });

  const members = membersData?.members ?? [];
  const existingMemberIds = new Set(members.map((m) => m.id));

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await tenantsApi.delete(tenant.id);
      toast.success(`Tenant "${tenant.name}" eliminado.`);
      onDeleted();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error al eliminar tenant.");
    } finally {
      setDeleteLoading(false);
      setShowDelete(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <Building2 size={20} className="text-indigo-600" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-900">{tenant.name}</h3>
              <span className="text-xs text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                {tenant.slug}
              </span>
              {!tenant.active && (
                <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">
                  Inactivo
                </span>
              )}
            </div>
            {tenant.description && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{tenant.description}</p>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {isAdmin && (
              <>
                <button
                  onClick={() => onEdit(tenant)}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="Editar tenant"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setShowDelete(true)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Eliminar tenant"
                >
                  <Trash2 size={15} />
                </button>
              </>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="ml-1 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Users size={13} />
              {expanded && membersData ? `${members.length} miembro${members.length !== 1 ? "s" : ""}` : "Miembros"}
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="border-t border-gray-100">
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50">
              <p className="text-xs text-gray-500 font-medium">
                {members.length} miembro{members.length !== 1 ? "s" : ""}
              </p>
              {isAdmin && (
                <button
                  onClick={() => setShowAddMember(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  <UserPlus size={13} />
                  Agregar miembro
                </button>
              )}
            </div>

            {members.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <Users size={28} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">Este tenant no tiene miembros aún.</p>
                {isAdmin && (
                  <button
                    onClick={() => setShowAddMember(true)}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50"
                  >
                    <UserPlus size={13} />
                    Agregar primer miembro
                  </button>
                )}
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-100">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Usuario</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {members.map((m) => (
                    <MemberRow
                      key={m.id}
                      member={m}
                      tenantId={tenant.id}
                      allTenants={allTenants}
                      isAdmin={isAdmin}
                      onChanged={refetchMembers}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {showAddMember && (
        <AddMemberModal
          tenantId={tenant.id}
          tenantName={tenant.name}
          existingMemberIds={existingMemberIds}
          onClose={() => setShowAddMember(false)}
          onAdded={refetchMembers}
        />
      )}

      <ConfirmDialog
        open={showDelete}
        title="Eliminar tenant"
        message={`¿Eliminar el tenant "${tenant.name}"? Se eliminará el grupo de Keycloak y sus miembros perderán acceso.`}
        confirmLabel="Eliminar"
        danger
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Tenants() {
  const { isAdmin } = useRoles();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<TenantView | null>(null);
  const [search, setSearch] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["tenants"],
    queryFn: tenantsApi.list,
  });

  const allTenants = data?.tenants ?? [];
  const tenants = allTenants.filter((t) =>
    search
      ? t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.slug.toLowerCase().includes(search.toLowerCase()) ||
        (t.description ?? "").toLowerCase().includes(search.toLowerCase())
      : true
  );

  const handleSaved = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["tenants"] });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.total !== undefined
              ? `${data.total} tenant${data.total !== 1 ? "s" : ""} — grupos de Keycloak`
              : "Cargando..."}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus size={16} />
            Nuevo tenant
          </button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o slug..."
          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="flex items-center gap-2 text-gray-400">
            <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Cargando tenants desde Keycloak...</span>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">
          <p className="font-medium mb-1">Error al cargar tenants</p>
          <p className="text-xs text-red-500">
            {(error as any)?.response?.status === 403
              ? "Sin permiso. Asigna el rol SUPER_ADMIN o IAM_ADMIN en Keycloak y vuelve a iniciar sesión."
              : (error as any)?.message ?? "Verifica la conexión con Keycloak."}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-3 px-3 py-1.5 text-xs font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-100"
          >
            Reintentar
          </button>
        </div>
      ) : tenants.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <Building2 size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">
            {search ? "Sin tenants con ese nombre." : "No hay tenants registrados."}
          </p>
          {!search && isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
            >
              <Plus size={15} />
              Crear primer tenant
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {tenants.map((tenant) => (
            <TenantCard
              key={tenant.id}
              tenant={tenant}
              allTenants={allTenants}
              isAdmin={isAdmin}
              onEdit={setEditTarget}
              onDeleted={handleSaved}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <TenantFormModal onClose={() => setShowCreate(false)} onSaved={handleSaved} />
      )}
      {editTarget && (
        <TenantFormModal
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
