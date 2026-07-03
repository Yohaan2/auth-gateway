import { useState, useMemo } from "react";
import { Search, ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft } from "lucide-react";
import type { KcRole } from "../api/admin-api";

interface Props {
  allRoles: KcRole[];
  assignedRoles: KcRole[];
  onChange: (assigned: KcRole[]) => void;
  disabled?: boolean;
}

export default function RoleDualList({ allRoles, assignedRoles, onChange, disabled = false }: Props) {
  const [leftSearch, setLeftSearch] = useState("");
  const [rightSearch, setRightSearch] = useState("");
  const [leftSelected, setLeftSelected] = useState<Set<string>>(new Set());
  const [rightSelected, setRightSelected] = useState<Set<string>>(new Set());

  const assignedIds = useMemo(() => new Set(assignedRoles.map((r) => r.id)), [assignedRoles]);

  const available = useMemo(
    () =>
      allRoles
        .filter((r) => !assignedIds.has(r.id))
        .filter((r) => r.name.toLowerCase().includes(leftSearch.toLowerCase())),
    [allRoles, assignedIds, leftSearch]
  );

  const assigned = useMemo(
    () => assignedRoles.filter((r) => r.name.toLowerCase().includes(rightSearch.toLowerCase())),
    [assignedRoles, rightSearch]
  );

  const toggle = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  };

  const moveRight = (ids: Set<string>) => {
    const toAdd = allRoles.filter((r) => ids.has(r.id) && !assignedIds.has(r.id));
    onChange([...assignedRoles, ...toAdd]);
    setLeftSelected(new Set());
  };

  const moveLeft = (ids: Set<string>) => {
    onChange(assignedRoles.filter((r) => !ids.has(r.id)));
    setRightSelected(new Set());
  };

  const RoleList = ({
    roles,
    selected,
    onToggle,
  }: {
    roles: KcRole[];
    selected: Set<string>;
    onToggle: (id: string) => void;
  }) => (
    <div className="flex-1 border border-gray-200 rounded-lg overflow-y-auto max-h-56 bg-white">
      {roles.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">Sin roles</p>
      ) : (
        roles.map((role) => (
          <button
            key={role.id}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(role.id)}
            className={`w-full text-left px-3 py-2 text-sm border-b border-gray-100 last:border-0 transition-colors ${
              selected.has(role.id)
                ? "bg-indigo-50 text-indigo-700 font-medium"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span className="font-medium">{role.name}</span>
            {role.description && (
              <span className="text-xs text-gray-400 block truncate">{role.description}</span>
            )}
          </button>
        ))
      )}
    </div>
  );

  return (
    <div className="flex gap-3 items-start">
      {/* Disponibles */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Disponibles ({available.length})
          </span>
        </div>
        <div className="relative mb-1.5">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={leftSearch}
            onChange={(e) => setLeftSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>
        <RoleList
          roles={available}
          selected={leftSelected}
          onToggle={(id) => setLeftSelected((s) => toggle(s, id))}
        />
      </div>

      {/* Botones */}
      <div className="flex flex-col gap-1.5 pt-14">
        <button
          type="button"
          disabled={disabled || leftSelected.size === 0}
          onClick={() => moveRight(leftSelected)}
          title="Asignar seleccionados"
          className="p-1.5 rounded border border-gray-200 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={14} />
        </button>
        <button
          type="button"
          disabled={disabled || available.length === 0}
          onClick={() => moveRight(new Set(available.map((r) => r.id)))}
          title="Asignar todos"
          className="p-1.5 rounded border border-gray-200 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsRight size={14} />
        </button>
        <button
          type="button"
          disabled={disabled || rightSelected.size === 0}
          onClick={() => moveLeft(rightSelected)}
          title="Quitar seleccionados"
          className="p-1.5 rounded border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          type="button"
          disabled={disabled || assignedRoles.length === 0}
          onClick={() => moveLeft(new Set(assignedRoles.map((r) => r.id)))}
          title="Quitar todos"
          className="p-1.5 rounded border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsLeft size={14} />
        </button>
      </div>

      {/* Asignados */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Asignados ({assignedRoles.length})
          </span>
        </div>
        <div className="relative mb-1.5">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={rightSearch}
            onChange={(e) => setRightSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>
        <RoleList
          roles={assigned}
          selected={rightSelected}
          onToggle={(id) => setRightSelected((s) => toggle(s, id))}
        />
      </div>
    </div>
  );
}
