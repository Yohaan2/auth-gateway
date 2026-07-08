import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, User, Shield, Mail, ChevronDown, Loader2, CheckCircle2, Building2 } from "lucide-react";
import { usersApi, templatesApi, tenantsApi, type AccessTemplate, type TenantView } from "../../api/admin-api";
import toast from "react-hot-toast";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

const INITIAL_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  username: "",
  tenantId: "",
  templateId: "",
  enabled: true,
  sendActivationEmail: false,
  password: "",
  temporaryPassword: false,
};

type FormState = typeof INITIAL_FORM;

function InputField({
  label,
  id,
  required,
  children,
}: {
  label: string;
  id: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-gray-600 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all bg-white placeholder:text-gray-300";

export default function CreateUserModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ["access-templates"],
    queryFn: templatesApi.list,
  });

  const { data: tenantsData, isLoading: loadingTenants } = useQuery({
    queryKey: ["tenants"],
    queryFn: tenantsApi.list,
  });
  const availableTenants: TenantView[] = tenantsData?.tenants ?? [];

  const activeTemplates = templates.filter((t: AccessTemplate) => t.active);
  const selectedTemplate = activeTemplates.find((t: AccessTemplate) => t.id === form.templateId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.username.trim()) {
      toast.error("El username es obligatorio.");
      return;
    }
    if (!form.email.trim()) {
      toast.error("El email es obligatorio.");
      return;
    }

    setLoading(true);
    try {
      const result = await usersApi.createProvisioned({
        username: form.username.trim(),
        email: form.email.trim(),
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        tenantId: form.tenantId || undefined,
        templateId: form.templateId || undefined,
        enabled: form.enabled,
        sendActivationEmail: form.sendActivationEmail,
        password: form.password || undefined,
        temporaryPassword: form.temporaryPassword,
      });

      const msg = result.templateApplied
        ? "Usuario creado y aprovisionado con la plantilla."
        : "Usuario creado exitosamente.";
      toast.success(msg);
      onCreated();
    } catch (err: any) {
      const detail = err?.response?.data?.error ?? err?.message ?? "Error al crear el usuario.";
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <User size={15} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Nuevo usuario</h2>
              <p className="text-xs text-gray-500">Creación con aprovisionamiento automático</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">

            {/* ── Sección 1: Identidad ─────────────────────────────── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-5 h-5 rounded bg-indigo-100 flex items-center justify-center">
                  <User size={11} className="text-indigo-600" />
                </div>
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Datos de identidad
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <InputField label="Nombre" id="firstName">
                  <input
                    id="firstName"
                    type="text"
                    value={form.firstName}
                    onChange={(e) => set("firstName", e.target.value)}
                    className={inputClass}
                    placeholder="Juan"
                  />
                </InputField>

                <InputField label="Apellido" id="lastName">
                  <input
                    id="lastName"
                    type="text"
                    value={form.lastName}
                    onChange={(e) => set("lastName", e.target.value)}
                    className={inputClass}
                    placeholder="García"
                  />
                </InputField>

                <InputField label="Email" id="email" required>
                  <input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    className={inputClass}
                    placeholder="juan@empresa.com"
                    required
                  />
                </InputField>

                <InputField label="Username" id="username" required>
                  <input
                    id="username"
                    type="text"
                    value={form.username}
                    onChange={(e) => set("username", e.target.value.toLowerCase().replace(/\s/g, "."))}
                    className={inputClass}
                    placeholder="juan.garcia"
                    required
                  />
                </InputField>
              </div>
            </section>

            {/* Divisor */}
            <div className="border-t border-gray-100" />

            {/* ── Sección 2: Aprovisionamiento ─────────────────────── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-5 h-5 rounded bg-violet-100 flex items-center justify-center">
                  <Shield size={11} className="text-violet-600" />
                </div>
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Aprovisionamiento
                </h3>
              </div>

              <div className="space-y-3">
                {/* Tenant */}
                <InputField label="Tenant" id="tenantId">
                  <div className="relative">
                    <Building2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <select
                      id="tenantId"
                      value={form.tenantId}
                      onChange={(e) => set("tenantId", e.target.value)}
                      className={`${inputClass} appearance-none pl-8 pr-8`}
                      disabled={loadingTenants}
                    >
                      <option value="">
                        {loadingTenants ? "Cargando tenants..." : "Sin tenant (acceso global)"}
                      </option>
                      {availableTenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {t.description ? ` — ${t.description}` : ""}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={13}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    />
                  </div>
                  {form.tenantId && (
                    <div className="mt-2 p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center gap-2">
                      <Building2 size={13} className="text-indigo-500 flex-shrink-0" />
                      <p className="text-xs text-indigo-700 font-medium">
                        {availableTenants.find((t) => t.id === form.tenantId)?.name ?? form.tenantId}
                      </p>
                    </div>
                  )}
                  {!form.tenantId && (
                    <p className="text-xs text-gray-400 mt-1">
                      Sin tenant: el usuario se crea sin asignación de organización.
                    </p>
                  )}
                </InputField>

                {/* Plantilla de acceso */}
                <InputField label="Plantilla de acceso" id="templateId">
                  <div className="relative">
                    <select
                      id="templateId"
                      value={form.templateId}
                      onChange={(e) => set("templateId", e.target.value)}
                      className={`${inputClass} appearance-none pr-8`}
                      disabled={loadingTemplates}
                    >
                      <option value="">
                        {loadingTemplates ? "Cargando plantillas..." : "Sin plantilla (acceso básico)"}
                      </option>
                      {activeTemplates.map((t: AccessTemplate) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {t.description ? ` — ${t.description}` : ""}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={13}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    />
                  </div>

                  {/* Preview de la plantilla seleccionada */}
                  {selectedTemplate && (
                    <div className="mt-2 p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                      <p className="text-xs font-semibold text-indigo-700 mb-1">
                        Plantilla seleccionada: {selectedTemplate.name}
                      </p>
                      {selectedTemplate.description && (
                        <p className="text-xs text-indigo-500">{selectedTemplate.description}</p>
                      )}
                    </div>
                  )}

                  {!form.templateId && (
                    <p className="text-xs text-gray-400 mt-1">
                      Sin plantilla: el usuario se crea en Keycloak sin roles ni grupos adicionales.
                    </p>
                  )}
                </InputField>
              </div>
            </section>

            {/* Divisor */}
            <div className="border-t border-gray-100" />

            {/* ── Sección 3: Opciones ───────────────────────────────── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-5 h-5 rounded bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 size={11} className="text-emerald-600" />
                </div>
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Opciones
                </h3>
              </div>

              <div className="space-y-3">
                {/* Contraseña manual inicial */}
                <div className="p-3 bg-gray-50 rounded-xl space-y-3">
                  <InputField label="Establecer contraseña" id="password">
                    <input
                      id="password"
                      type="password"
                      value={form.password}
                      onChange={(e) => set("password", e.target.value)}
                      className={inputClass}
                      placeholder="Escribe la contraseña inicial..."
                    />
                  </InputField>

                  {form.password && (
                    <label className="flex items-center justify-between cursor-pointer group">
                      <div>
                        <p className="text-xs font-semibold text-gray-700">Contraseña temporal</p>
                        <p className="text-[11px] text-gray-400">
                          Forzará al usuario a cambiar la contraseña al iniciar sesión por primera vez.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={form.temporaryPassword}
                        onChange={(e) => set("temporaryPassword", e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-400 flex-shrink-0"
                      />
                    </label>
                  )}
                </div>

                {/* Estado inicial */}
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors group">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Usuario activo</p>
                    <p className="text-xs text-gray-500">
                      El usuario podrá iniciar sesión inmediatamente.
                    </p>
                  </div>
                  <div
                    className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 ${
                      form.enabled ? "bg-indigo-600" : "bg-gray-300"
                    }`}
                    style={{ height: "22px", width: "40px" }}
                  >
                    <input
                      type="checkbox"
                      checked={form.enabled}
                      onChange={(e) => set("enabled", e.target.checked)}
                      className="sr-only"
                    />
                    <span
                      className={`absolute top-0.5 left-0.5 w-4.5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                        form.enabled ? "translate-x-[18px]" : "translate-x-0"
                      }`}
                      style={{ width: "18px", height: "18px" }}
                    />
                  </div>
                </label>

                {/* Email de activación */}
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors group">
                  <div className="flex items-start gap-2.5">
                    <Mail size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">Enviar email de activación</p>
                      <p className="text-xs text-gray-500">
                        Keycloak enviará un enlace para que el usuario establezca su contraseña.
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.sendActivationEmail}
                    onChange={(e) => set("sendActivationEmail", e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-400 flex-shrink-0"
                  />
                </label>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition-colors shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Aprovisionando...
                </>
              ) : (
                <>
                  <User size={14} />
                  Crear usuario
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
