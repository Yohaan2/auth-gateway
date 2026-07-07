import { useQuery } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { iamApi, type IamPermission, type IamRole } from "../api/admin-api";

/**
 * Consulta `/api/iam/me` y expone los roles/permisos administrativos del
 * IAM del usuario autenticado. La UI usa `hasPermission` / `hasRole` para
 * mostrar u ocultar módulos según lo que el backend autorice.
 */
export function useIamAccess() {
  const { isAuthenticated } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["iam-me"],
    queryFn: iamApi.me,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const roles: IamRole[] = data?.roles ?? [];
  const permissions: IamPermission[] = data?.permissions ?? [];

  return {
    roles,
    permissions,
    isSuperAdmin: data?.isSuperAdmin ?? false,
    isLoading,
    error,
    hasRole: (...allowed: IamRole[]) => allowed.some((r) => roles.includes(r)),
    hasPermission: (...allowed: IamPermission[]) => allowed.some((p) => permissions.includes(p)),
  };
}
