import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, CheckCircle, XCircle, Trash2, KeyRound, LogOut,
  Monitor, RefreshCw, Mail, Save, Shield, LayoutTemplate, RotateCcw, RefreshCwIcon
} from "lucide-react";
import {
  usersApi, rolesApi, clientsApi, templatesApi,
  type KcRole, type AccessTemplate, IAM_PERMISSIONS
} from "../api/admin-api";
import ConfirmDialog from "../components/ConfirmDialog";
import RoleDualList from "../components/RoleDualList";
import { useRoles } from "../auth/useRoles";
import { useIamAccess } from "../auth/useIamAccess";
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
  const { hasPermission } = useIamAccess();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [resetPwForm, setResetPwForm] = useState({ open: false, password: "", temporary: true });
  const [editForm, setEditForm] = useState<null | Record<string, any>>(null);
  // Fase 4: estado para cambio de plantilla
  const [changeTemplateOpen, setChangeTemplateOpen] = useState(false);
  const [selectedNewTemplate, setSelectedNewTemplate] = useState("");
  const [provActionLoading, setProvActionLoading] = useState<string | null>(null);

  const userQ = useQuery({ queryKey: ["user", id], queryFn: () => usersApi.get(id!) });
  const sessionsQ = useQuery({ queryKey: ["user-sessions", id], queryFn: () => usersApi.getSessions(id!) });
  const roleMappingsQ = useQuery({ queryKey: ["user-roles", id], queryFn: () => usersApi.getRoles(id!) });
  const allRealmRolesQ = useQuery({ queryKey: ["realm-roles"], queryFn: rolesApi.list });
  const clientsQ = useQuery({ queryKey: ["clients"], queryFn: () => clientsApi.list() });
  // Fase 4: perfil IAM del usuario desde DB local
  const iamProfileQ = useQuery({
    queryKey: ["iam-user-profile", id],
    queryFn: () => usersApi.getIamProfile(id!),
    retry: false, // 404 es válido (usuario sin perfil IAM)
  });
  // Fase 4: plantillas disponibles para cambio
  const templatesQ = useQuery({ queryKey: ["access-templates"], queryFn: templatesApi.list });

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

  // ─── Handlers Fase 4 (aprovisionamiento) ────────────────────────────────

  const handleChangeTemplate = async () => {
    if (!selectedNewTemplate) return;
    setProvActionLoading("change");
    try {
      await usersApi.changeTemplate(id!, selectedNewTemplate);
      toast.success("Plantilla de acceso actualizada.");
      setChangeTemplateOpen(false);
      setSelectedNewTemplate("");
      iamProfileQ.refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error al cambiar la plantilla.");
    } finally {
      setProvActionLoading(null);
    }
  };

  const handleReapplyTemplate = async () => {
    setProvActionLoading("reapply");
    try {
      await usersApi.reapplyTemplate(id!);
      toast.success("Plantilla reaplicada exitosamente.");
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error al reaplicar la plantilla.");
    } finally {
      setProvActionLoading(null);
    }
  };

  const handleSyncUser = async () => {
    setProvActionLoading("sync");
    try {
      await usersApi.syncUser(id!);
      toast.success("Usuario sincronizado.");
      iamProfileQ.refetch();
      userQ.refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error al sincronizar.");
    } finally {
      setProvActionLoading(null);
    }
  };

  const handleSendActivationEmail = async () => {
    setProvActionLoading("email");
    try {
      await usersApi.sendActivationEmail(id!);
      toast.success("Email de activación enviado.");
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error al enviar email de activación.");
    } finally {
      setProvActionLoading(null);
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
                { key: "username", label: "Username", disabled: true },
                { key: "email", label: "Email", type: "email" },
                { key: "firstName", label: "Nombre" },
                { key: "lastName", label: "Apellido" },
              ].map(({ key, label, type = "text", disabled = false }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {label}
                    {disabled && <span className="ml-1.5 text-gray-400 font-normal">(no editable)</span>}
                  </label>
                  <input
                    type={type}
                    value={editForm[key]}
                    onChange={(e) => setEditForm((f) => ({ ...f!, [key]: e.target.value }))}
                    disabled={disabled}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                      disabled
                        ? "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed"
                        : "border-gray-200"
                    }`}
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
      {hasPermission(IAM_PERMISSIONS.MANAGE_USERS) && (
        <Section title="Roles del Realm">
          {roleMappingsQ.isLoading || allRealmRolesQ.isLoading ? (
            <p className="text-sm text-gray-400">Cargando roles...</p>
          ) : (
            <RoleDualList
              allRoles={allRealmRolesQ.data ?? []}
              assignedRoles={assignedRealmRoles}
              onChange={handleRealmRoleChange}
              disabled={false}
            />
          )}
        </Section>
      )}

      {/* Roles por módulo (Client Roles) */}
      <Section title="Roles por Módulo">
        {clientsQ.isLoading ? (
          <p className="text-sm text-gray-400">Cargando módulos...</p>
        ) : (clientsQ.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            No hay módulos registrados. Crea uno en la sección{" "}
            <Link to="/modules" className="text-indigo-600 underline">Módulos</Link>.
          </p>
        ) : (
          <div className="space-y-5">
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
        )}
      </Section>

      {/* ─── Sección Aprovisionamiento IAM (Fase 4) ────────────────── */}
      {hasPermission(IAM_PERMISSIONS.MANAGE_USERS) && (
        <Section title="Aprovisionamiento IAM">
          {iamProfileQ.isLoading ? (
            <p className="text-sm text-gray-400">Cargando perfil IAM...</p>
          ) : !iamProfileQ.data ? (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
              <Shield size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Sin perfil IAM</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Este usuario fue creado antes de la Fase 4 o directamente en Keycloak.
                  No tiene un perfil IAM registrado en la base de datos del IAM.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Info */}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                <div>
                  <dt className="text-xs text-gray-500 font-medium">Tenant</dt>
                  <dd className="text-sm text-gray-800 mt-0.5">
                    {iamProfileQ.data.tenant ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                        {iamProfileQ.data.tenant}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">Sin tenant asignado</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500 font-medium">Plantilla de acceso</dt>
                  <dd className="text-sm text-gray-800 mt-0.5">
                    {iamProfileQ.data.template ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-700 rounded-full text-xs font-medium">
                        <LayoutTemplate size={10} />
                        {iamProfileQ.data.template.name}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">Sin plantilla asignada</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500 font-medium">Creado en IAM</dt>
                  <dd className="text-sm text-gray-800 mt-0.5">
                    {new Date(iamProfileQ.data.createdAt).toLocaleString("es-MX")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500 font-medium">Última actualización</dt>
                  <dd className="text-sm text-gray-800 mt-0.5">
                    {new Date(iamProfileQ.data.updatedAt).toLocaleString("es-MX")}
                  </dd>
                </div>
              </dl>

              {/* Acciones */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                {/* Cambiar plantilla */}
                <button
                  onClick={() => setChangeTemplateOpen(true)}
                  disabled={provActionLoading !== null}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 disabled:opacity-50 transition-colors"
                >
                  <LayoutTemplate size={12} />
                  Cambiar plantilla
                </button>

                {/* Reaplicar plantilla */}
                {iamProfileQ.data.templateId && (
                  <button
                    onClick={handleReapplyTemplate}
                    disabled={provActionLoading !== null}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                  >
                    {provActionLoading === "reapply" ? (
                      <RefreshCwIcon size={12} className="animate-spin" />
                    ) : (
                      <RotateCcw size={12} />
                    )}
                    Reaplicar plantilla
                  </button>
                )}

                {/* Sincronizar con Keycloak */}
                <button
                  onClick={handleSyncUser}
                  disabled={provActionLoading !== null}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {provActionLoading === "sync" ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                  Sincronizar con Keycloak
                </button>

                {/* Email de activación */}
                {isAdmin && (
                  <button
                    onClick={handleSendActivationEmail}
                    disabled={provActionLoading !== null}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                  >
                    {provActionLoading === "email" ? (
                      <Mail size={12} className="animate-spin" />
                    ) : (
                      <Mail size={12} />
                    )}
                    Enviar email de activación
                  </button>
                )}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* Modal: cambio de plantilla */}
      {changeTemplateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setChangeTemplateOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-sm font-bold text-gray-900">Cambiar plantilla de acceso</h3>
            <p className="text-xs text-gray-500">
              Se desasignarán los roles/grupos de la plantilla actual y se aplicarán los de la nueva.
            </p>
            <select
              value={selectedNewTemplate}
              onChange={(e) => setSelectedNewTemplate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">Selecciona una plantilla...</option>
              {(templatesQ.data ?? []).filter((t: AccessTemplate) => t.active).map((t: AccessTemplate) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setChangeTemplateOpen(false); setSelectedNewTemplate(""); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleChangeTemplate}
                disabled={!selectedNewTemplate || provActionLoading === "change"}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {provActionLoading === "change" ? "Aplicando..." : "Cambiar plantilla"}
              </button>
            </div>
          </div>
        </div>
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
  const { data: allRoles, isLoading } = useQuery({
    queryKey: ["client-roles", clientId],
    queryFn: () => clientsApi.getRoles(clientId),
  });

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
    <div className="rounded-lg border border-gray-100 p-4 bg-gray-50/50">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          {clientName}
        </p>
        {(allRoles?.length ?? 0) === 0 && !isLoading && (
          <Link
            to="/modules"
            className="text-xs text-indigo-500 hover:text-indigo-700"
          >
            + Crear roles en Módulos →
          </Link>
        )}
      </div>
      {isLoading ? (
        <p className="text-xs text-gray-400">Cargando roles...</p>
      ) : (allRoles?.length ?? 0) === 0 ? (
        <p className="text-xs text-gray-400 py-2">
          Este módulo no tiene roles definidos. Ve a{" "}
          <Link to="/modules" className="text-indigo-500 underline">Módulos</Link>{" "}
          y crea los roles primero.
        </p>
      ) : (
        <RoleDualList
          allRoles={allRoles ?? []}
          assignedRoles={assignedRoles}
          onChange={handleChange}
          disabled={!isAdmin}
        />
      )}
    </div>
  );
}
