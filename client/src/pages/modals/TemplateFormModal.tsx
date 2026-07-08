import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  templatesApi,
  type AccessTemplateDetail,
  type TemplatePayload,
  type TemplateRoleInput,
  type TemplateClaimInput,
  type TemplatePermissionInput,
} from "../../api/admin-api";

interface Props {
  initial?: AccessTemplateDetail;
  onClose: () => void;
  onSaved: () => void;
}

type TabKey = "general" | "roles" | "claims" | "permissions";

const TABS: { key: TabKey; label: string }[] = [
  { key: "general", label: "General" },
  { key: "roles", label: "Roles" },
  { key: "claims", label: "Claims" },
  { key: "permissions", label: "Permisos" },
];

export default function TemplateFormModal({ initial, onClose, onSaved }: Props) {
  const [tab, setTab] = useState<TabKey>("general");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [roles, setRoles] = useState<TemplateRoleInput[]>(initial?.roles ?? []);
  const [claims, setClaims] = useState<TemplateClaimInput[]>(initial?.claims ?? []);
  const [permissions, setPermissions] = useState<TemplatePermissionInput[]>(
    initial?.permissions ?? []
  );
  const [loading, setLoading] = useState(false);

  const kcRolesQ = useQuery({
    queryKey: ["kc-roles-for-templates"],
    queryFn: templatesApi.listKeycloakRoles,
    staleTime: 60_000,
  });

  const [selectedRole, setSelectedRole] = useState("");
  const [newClaim, setNewClaim] = useState({ claimKey: "", claimValue: "" });
  const [newPermission, setNewPermission] = useState<TemplatePermissionInput>({
    resource: "",
    action: "",
    effect: "allow",
    description: "",
  });

  const addRole = () => {
    const kcRole = kcRolesQ.data?.find((r) => r.name === selectedRole);
    if (!kcRole) return;
    if (roles.some((r) => r.roleName === kcRole.name)) {
      toast.error("Ese rol ya fue agregado.");
      return;
    }
    setRoles((prev) => [...prev, { roleName: kcRole.name, roleId: kcRole.id, isClientRole: false }]);
    setSelectedRole("");
  };

  const addClaim = () => {
    if (!newClaim.claimKey.trim()) {
      toast.error("La clave del claim es obligatoria.");
      return;
    }
    setClaims((prev) => [...prev, { ...newClaim }]);
    setNewClaim({ claimKey: "", claimValue: "" });
  };

  const addPermission = () => {
    if (!newPermission.resource.trim() || !newPermission.action.trim()) {
      toast.error("Recurso y acción son obligatorios.");
      return;
    }
    setPermissions((prev) => [...prev, { ...newPermission }]);
    setNewPermission({ resource: "", action: "", effect: "allow", description: "" });
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("El nombre es obligatorio.");
      setTab("general");
      return;
    }
    setLoading(true);
    try {
      const payload: TemplatePayload = {
        name: name.trim(),
        description: description.trim() || undefined,
        active,
        roles,
        claims,
        permissions,
      };
      if (initial) {
        await templatesApi.update(initial.id, payload);
        toast.success("Plantilla actualizada.");
      } else {
        await templatesApi.create(payload);
        toast.success("Plantilla creada.");
      }
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error al guardar la plantilla.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">
            {initial ? "Editar plantilla" : "Nueva plantilla de acceso"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="flex border-b px-6 gap-4 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                tab === t.key
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
              {t.key === "roles" && roles.length > 0 && ` (${roles.length})`}
              {t.key === "claims" && claims.length > 0 && ` (${claims.length})`}
              {t.key === "permissions" && permissions.length > 0 && ` (${permissions.length})`}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {tab === "general" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Plantilla de acceso: Soporte Nivel 1"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  placeholder="Descripción opcional..."
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-400"
                />
                Plantilla activa
              </label>
            </div>
          )}

          {tab === "roles" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">
                    {kcRolesQ.isLoading ? "Cargando roles de Keycloak..." : "Seleccionar rol de Keycloak..."}
                  </option>
                  {kcRolesQ.data?.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addRole}
                  type="button"
                  className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="space-y-1">
                {roles.length === 0 && <p className="text-xs text-gray-400">Sin roles asociados.</p>}
                {roles.map((r, idx) => (
                  <div
                    key={`${r.roleName}-${idx}`}
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm"
                  >
                    <span className="text-gray-800">{r.roleName}</span>
                    <button
                      onClick={() => setRoles((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "claims" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newClaim.claimKey}
                  onChange={(e) => setNewClaim((c) => ({ ...c, claimKey: e.target.value }))}
                  placeholder="clave"
                  className="w-1/3 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <input
                  type="text"
                  value={newClaim.claimValue}
                  onChange={(e) => setNewClaim((c) => ({ ...c, claimValue: e.target.value }))}
                  placeholder="valor"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                  onClick={addClaim}
                  type="button"
                  className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="space-y-1">
                {claims.length === 0 && <p className="text-xs text-gray-400">Sin claims personalizados.</p>}
                {claims.map((c, idx) => (
                  <div
                    key={`${c.claimKey}-${idx}`}
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm"
                  >
                    <span className="text-gray-800">
                      <span className="font-medium">{c.claimKey}</span> = {c.claimValue}
                    </span>
                    <button
                      onClick={() => setClaims((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "permissions" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newPermission.resource}
                  onChange={(e) => setNewPermission((p) => ({ ...p, resource: e.target.value }))}
                  placeholder="recurso (ej: invoices)"
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <input
                  type="text"
                  value={newPermission.action}
                  onChange={(e) => setNewPermission((p) => ({ ...p, action: e.target.value }))}
                  placeholder="acción (ej: read)"
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <select
                  value={newPermission.effect}
                  onChange={(e) =>
                    setNewPermission((p) => ({ ...p, effect: e.target.value as "allow" | "deny" }))
                  }
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="allow">Permitir</option>
                  <option value="deny">Denegar</option>
                </select>
                <input
                  type="text"
                  value={newPermission.description}
                  onChange={(e) => setNewPermission((p) => ({ ...p, description: e.target.value }))}
                  placeholder="descripción (opcional)"
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <button
                onClick={addPermission}
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
              >
                <Plus size={14} />
                Agregar permiso
              </button>
              <div className="space-y-1">
                {permissions.length === 0 && (
                  <p className="text-xs text-gray-400">Sin permisos finos definidos.</p>
                )}
                {permissions.map((p, idx) => (
                  <div
                    key={`${p.resource}-${p.action}-${idx}`}
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm"
                  >
                    <span className="text-gray-800">
                      <span
                        className={`font-medium ${p.effect === "deny" ? "text-red-600" : "text-emerald-600"}`}
                      >
                        {p.effect === "deny" ? "Denegar" : "Permitir"}
                      </span>{" "}
                      {p.resource}:{p.action}
                      {p.description && <span className="text-gray-400"> — {p.description}</span>}
                    </span>
                    <button
                      onClick={() => setPermissions((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">
                Los permisos finos solo se almacenan en esta fase; no se evalúan aún.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar plantilla"}
          </button>
        </div>
      </div>
    </div>
  );
}
