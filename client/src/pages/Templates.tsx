import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, LayoutTemplate } from "lucide-react";
import toast from "react-hot-toast";
import { templatesApi, type AccessTemplate, type AccessTemplateDetail } from "../api/admin-api";
import ConfirmDialog from "../components/ConfirmDialog";
import TemplateFormModal from "./modals/TemplateFormModal";
import { useIamAccess } from "../auth/useIamAccess";

export default function Templates() {
  const { hasPermission } = useIamAccess();
  const canManage = hasPermission("iam:manage_templates");

  const { data: templates = [], isLoading, refetch } = useQuery({
    queryKey: ["access-templates"],
    queryFn: templatesApi.list,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AccessTemplateDetail | null>(null);
  const [deleting, setDeleting] = useState<AccessTemplate | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  const handleEdit = async (template: AccessTemplate) => {
    setLoadingDetail(template.id);
    try {
      const detail = await templatesApi.get(template.id);
      setEditing(detail);
    } catch {
      toast.error("Error al cargar la plantilla.");
    } finally {
      setLoadingDetail(null);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await templatesApi.delete(deleting.id);
      toast.success("Plantilla eliminada.");
      refetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Error al eliminar la plantilla.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plantillas de Acceso</h1>
          <p className="text-sm text-gray-500 mt-0.5">{templates.length} plantillas configuradas</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus size={16} />
            Nueva plantilla
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Descripción</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Cargando plantillas...</span>
                  </div>
                </td>
              </tr>
            ) : templates.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <LayoutTemplate size={28} className="text-gray-300" />
                    Sin plantillas de acceso configuradas.
                  </div>
                </td>
              </tr>
            ) : (
              templates.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{t.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{t.description || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        t.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {t.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManage && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(t)}
                          disabled={loadingDetail === t.id}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleting(t)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <TemplateFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            refetch();
          }}
        />
      )}

      {editing && (
        <TemplateFormModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refetch();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar plantilla"
        message={`¿Eliminar la plantilla "${deleting?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
