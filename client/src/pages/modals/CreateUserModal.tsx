import { useState } from "react";
import { X } from "lucide-react";
import { usersApi } from "../../api/admin-api";
import toast from "react-hot-toast";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateUserModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    username: "",
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    temporaryPassword: true,
    enabled: true,
    emailVerified: false,
  });
  const [loading, setLoading] = useState(false);

  const set = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username.trim()) {
      toast.error("El username es obligatorio.");
      return;
    }
    setLoading(true);
    try {
      await usersApi.create({
        username: form.username.trim(),
        email: form.email.trim() || undefined,
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        password: form.password || undefined,
        temporaryPassword: form.temporaryPassword,
        enabled: form.enabled,
      });
      toast.success("Usuario creado exitosamente.");
      onCreated();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error al crear usuario.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">Nuevo usuario</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Username <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => set("username", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="john.doe"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="john@ejemplo.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombre</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Apellido</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Contraseña inicial
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Dejar en blanco para no establecer"
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.temporaryPassword}
                onChange={(e) => set("temporaryPassword", e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-400"
              />
              Contraseña temporal (requerirá cambio)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => set("enabled", e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-400"
              />
              Usuario habilitado
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.emailVerified}
                onChange={(e) => set("emailVerified", e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-400"
              />
              Marcar email como verificado
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
