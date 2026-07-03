import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, CheckCircle, XCircle, Trash2, KeyRound, LogOut,
  Monitor, RefreshCw, Mail, Save
} from "lucide-react";
import { usersApi, rolesApi, clientsApi, type KcRole } from "../api/admin-api";
import ConfirmDialog from "../components/ConfirmDialog";
import RoleDualList from "../components/RoleDualList";
import { useRoles } from "../auth/useRoles";
import toast from "react-hot-toast";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin } = useRoles();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [resetPwForm, setResetPwForm] = useState({ open: false, password: "", temporary: true });
  const [editForm, setEditForm] = useState<null | Record<string, any>>(null);

  const userQ = useQuery({ queryKey: ["user", id], queryFn: () => usersApi.get(id!) });
  const sessionsQ = useQuery({ queryKey: ["user-sessions", id], queryFn: () => usersApi.getSessions(id!) });
  const roleMappingsQ = useQuery({ queryKey: ["user-roles", id], queryFn: () => usersApi.getRoles(id!) });
  const allRealmRolesQ = useQuery({ queryKey: ["realm-roles"], queryFn: rolesApi.list });
  const clientsQ = useQuery({ queryKey: ["clients"], queryFn: () => clientsApi.list() });

  const user = userQ.data;
  const assignedRealmRoles = roleMappingsQ.data?.realmMappings ?? [];

  // Abrir edición con datos actuales
  const openEdit = () =>
    setEditForm({
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      email: user?.email ?? "",
      username: user?.username ?? "",
      enabled: user?.enabled ?? true,
      emailVerified: user?.emailVerified ?? false,
    });

  const saveEdit = async () => {
    if (!editForm) return;
    try {
      await usersApi.update(id!, editForm);
      toast.success("Usuario actualizado.");
      setEditForm(null);
      qc.invalidateQueries({ queryKey: ["user", id] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error al actualizar.");
    }
  };

  const handleDelete = async () => {
    try {
      await usersApi.delete(id!);
      toast.success("Usuario eliminado.");
      navigate("/users");
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error al eliminar.");
    }
    setConfirmDelete(false);
  };

  const handleRevokeSessions = async () => {
    try {
      await usersApi.deleteSessions(id!);
      toast.success("Sesiones revocadas.");
      sessionsQ.refetch();
    } catch {
      toast.error("Error al revocar sesiones.");
    }
    setConfirmRevoke(false);
  };

  const handleResetPassword = async () => {
    if (!resetPwForm.password) return;
    try {
      await usersApi.resetPassword(id!, resetPwForm.password, resetPwForm.temporary);
      toast.success("Contraseña restablecida.");
      setResetPwForm({ open: false, password: "", temporary: true });
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error al restablecer contraseña.");
    }
  };

  const handleRealmRoleChange = async (newRoles: KcRole[]) => {
    const current = new Set(assignedRealmRoles.map((r) => r.id));
    const next = new Set(newRoles.map((r) => r.id));

    const toAdd = newRoles.filter((r) => !current.has(r.id));
    const toRemove = assignedRealmRoles.filter((r) => !next.has(r.id));

    try {
      if (toAdd.length) await usersApi.addRealmRoles(id!, toAdd);
      if (toRemove.length) await usersApi.removeRealmRoles(id!, toRemove);
      toast.success("Roles actualizados.");
      qc.invalidateQueries({ queryKey: ["user-roles", id] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error al actualizar roles.");
    }
  };

  if (userQ.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20 text-gray-500">
        Usuario no encontrado. <Link to="/users" className="text-indigo-600 underline">Volver</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/users" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {user.firstName || user.lastName
              ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
              : user.username}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
            user.enabled ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {user.enabled ? <CheckCircle size={12} /> : <XCircle size={12} />}
          {user.enabled ? "Activo" : "Deshabilitado"}
        </span>
        {isAdmin && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Eliminar usuario"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {/* Información general */}
      <Section title="Información general">
        {editForm ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "username", label: "Username" },
                { key: "email", label: "Email", type: "email" },
                { key: "firstName", label: "Nombre" },
                { key: "lastName", label: "Apellido" },
              ].map(({ key, label, type = "text" }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input
                    type={type}
                    value={editForm[key]}
                    onChange={(e) => setEditForm((f) => ({ ...f!, [key]: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.enabled}
                  onChange={(e) => setEditForm((f) => ({ ...f!, enabled: e.target.checked }))}
                  className="w-4 h-4 rounded text-indigo-600"
                />
                Habilitado
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.emailVerified}
                  onChange={(e) => setEditForm((f) => ({ ...f!, emailVerified: e.target.checked }))}
                  className="w-4 h-4 rounded text-indigo-600"
                />
                Email verificado
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={saveEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700"
              >
                <Save size={13} /> Guardar
              </button>
              <button
                onClick={() => setEditForm(null)}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5">
              {[
                ["Username", user.username],
                ["Email", user.email || "—"],
                ["Nombre", user.firstName || "—"],
                ["Apellido", user.lastName || "—"],
                ["ID Keycloak", user.id],
                [
                  "Creado",
                  user.createdTimestamp
                    ? new Date(user.createdTimestamp).toLocaleString("es-MX")
                    : "—",
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-gray-500 font-medium">{label}</dt>
                  <dd className="text-sm text-gray-800 mt-0.5 truncate">{value}</dd>
                </div>
              ))}
            </dl>
            {isAdmin && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={openEdit}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Editar datos
                </button>
                <button
                  onClick={() => setResetPwForm((f) => ({ ...f, open: true }))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100"
                >
                  <KeyRound size={13} /> Resetear contraseña
                </button>
                <button
                  onClick={() => usersApi.verifyEmail(id!).then(() => toast.success("Email de verificación enviado.")).catch(() => toast.error("Error al enviar verificación."))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                >
                  <Mail size={13} /> Verificar email
                </button>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Reset contraseña inline */}
      {resetPwForm.open && (
        <Section title="Restablecer contraseña">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-medium text-gray-600 mb-1">Nueva contraseña</label>
              <input
                type="password"
                value={resetPwForm.password}
                onChange={(e) => setResetPwForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={resetPwForm.temporary}
                onChange={(e) => setResetPwForm((f) => ({ ...f, temporary: e.target.checked }))}
                className="w-4 h-4 rounded text-indigo-600"
              />
              Temporal
            </label>
            <button
              onClick={handleResetPassword}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
            >
              Aplicar
            </button>
            <button
              onClick={() => setResetPwForm({ open: false, password: "", temporary: true })}
              className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </Section>
      )}

      {/* Sesiones activas */}
      <Section title="Sesiones activas">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-500">
            {sessionsQ.data?.length ?? 0} sesión(es) activa(s)
          </p>
          <div className="flex gap-2">
            <button onClick={() => sessionsQ.refetch()} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <RefreshCw size={14} />
            </button>
            {isAdmin && (sessionsQ.data?.length ?? 0) > 0 && (
              <button
                onClick={() => setConfirmRevoke(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
              >
                <LogOut size={13} /> Revocar todas
              </button>
            )}
          </div>
        </div>
        {sessionsQ.isLoading ? (
          <div className="text-sm text-gray-400 text-center py-4">Cargando sesiones...</div>
        ) : sessionsQ.data?.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Sin sesiones activas.</p>
        ) : (
          <div className="space-y-2">
            {sessionsQ.data?.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg text-sm">
                <Monitor size={15} className="text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-700 text-xs">{s.ipAddress || "IP desconocida"}</p>
                  <p className="text-xs text-gray-400">
                    Inicio: {s.start ? new Date(s.start).toLocaleString("es-MX") : "—"} ·
                    Último acceso: {s.lastAccess ? new Date(s.lastAccess).toLocaleString("es-MX") : "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Roles del Realm */}
      <Section title="Roles del Realm">
        {roleMappingsQ.isLoading || allRealmRolesQ.isLoading ? (
          <p className="text-sm text-gray-400">Cargando roles...</p>
        ) : (
          <RoleDualList
            allRoles={allRealmRolesQ.data ?? []}
            assignedRoles={assignedRealmRoles}
            onChange={handleRealmRoleChange}
            disabled={!isAdmin}
          />
        )}
      </Section>

      {/* Roles por módulo (Client Roles) */}
      {(clientsQ.data?.length ?? 0) > 0 && (
        <Section title="Roles por Módulo">
          <div className="space-y-4">
            {clientsQ.data?.map((client) => {
              const clientMappings = roleMappingsQ.data?.clientMappings?.[client.clientId];
              const assignedClientRoles = clientMappings?.mappings ?? [];

              return (
                <ClientRoleSection
                  key={client.id}
                  clientId={client.id}
                  clientName={client.name || client.clientId}
                  userId={id!}
                  assignedRoles={assignedClientRoles}
                  isAdmin={isAdmin}
                  onUpdate={() => qc.invalidateQueries({ queryKey: ["user-roles", id] })}
                />
              );
            })}
          </div>
        </Section>
      )}

      {/* Diálogos de confirmación */}
      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar usuario"
        message={`¿Estás seguro de que deseas eliminar al usuario "${user.username}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
      <ConfirmDialog
        open={confirmRevoke}
        title="Revocar sesiones"
        message={`¿Deseas cerrar todas las sesiones activas de "${user.username}"?`}
        confirmLabel="Revocar sesiones"
        danger
        onConfirm={handleRevokeSessions}
        onCancel={() => setConfirmRevoke(false)}
      />
    </div>
  );
}

// Subcomponente para roles de un cliente específico
function ClientRoleSection({
  clientId,
  clientName,
  userId,
  assignedRoles,
  isAdmin,
  onUpdate,
}: {
  clientId: string;
  clientName: string;
  userId: string;
  assignedRoles: KcRole[];
  isAdmin: boolean;
  onUpdate: () => void;
}) {
  const { data: allRoles } = useQuery({
    queryKey: ["client-roles", clientId],
    queryFn: () => clientsApi.getRoles(clientId),
  });

  if (!allRoles?.length) return null;

  const handleChange = async (newRoles: KcRole[]) => {
    const current = new Set(assignedRoles.map((r) => r.id));
    const next = new Set(newRoles.map((r) => r.id));
    const toAdd = newRoles.filter((r) => !current.has(r.id));
    const toRemove = assignedRoles.filter((r) => !next.has(r.id));
    try {
      if (toAdd.length) await usersApi.addClientRoles(userId, clientId, toAdd);
      if (toRemove.length) await usersApi.removeClientRoles(userId, clientId, toRemove);
      toast.success(`Roles de "${clientName}" actualizados.`);
      onUpdate();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error al actualizar roles de cliente.");
    }
  };

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        {clientName}
      </p>
      <RoleDualList
        allRoles={allRoles}
        assignedRoles={assignedRoles}
        onChange={handleChange}
        disabled={!isAdmin}
      />
    </div>
  );
}
