import type { KeycloakTokenPayload } from "../middleware/jwt-auth";
import {
  IAM_ROLES,
  ROLE_PERMISSIONS,
  isIamRole,
  type IamRole,
  type IamPermission,
} from "../config/iam-roles";
import { env } from "../config/env";

/**
 * Servicio encargado de consultar los roles administrativos del IAM
 * a partir del payload del JWT (access_token de Keycloak) del usuario
 * autenticado.
 */
export const iamRolesService = {
  /**
   * Extrae los roles administrativos del IAM presentes en `realm_access.roles`.
   *
   * Compatibilidad legacy: si el usuario tiene el rol de administrador del
   * panel (`KEYCLOAK_ADMIN_ROLE`, p. ej. `auth-manager-admin`) pero ningún
   * rol IAM explícito, se le otorga automáticamente `SUPER_ADMIN`. Esto
   * evita que la instalación inicial quede bloqueada antes de que el
   * administrador asigne los roles IAM desde Keycloak.
   */
  getUserIamRoles(payload?: KeycloakTokenPayload): IamRole[] {
    const realmRoles = payload?.realm_access?.roles ?? [];
    const iamRoles = realmRoles.filter(isIamRole);

    if (iamRoles.length === 0 && realmRoles.includes(env.KEYCLOAK_ADMIN_ROLE)) {
      return [IAM_ROLES.SUPER_ADMIN];
    }

    return iamRoles;
  },

  /**
   * Calcula el conjunto (sin duplicados) de permisos administrativos
   * disponibles para un usuario según sus roles IAM.
   */
  getPermissionsForRoles(roles: IamRole[]): IamPermission[] {
    const permissions = new Set<IamPermission>();
    for (const role of roles) {
      for (const permission of ROLE_PERMISSIONS[role] ?? []) {
        permissions.add(permission);
      }
    }
    return Array.from(permissions);
  },

  /** Azúcar sintáctico: roles + permisos calculados directamente desde el JWT. */
  getUserAccess(payload?: KeycloakTokenPayload) {
    const roles = this.getUserIamRoles(payload);
    return {
      roles,
      permissions: this.getPermissionsForRoles(roles),
      isSuperAdmin: roles.includes(IAM_ROLES.SUPER_ADMIN),
    };
  },

  hasAnyRole(payload: KeycloakTokenPayload | undefined, allowed: IamRole[]): boolean {
    const roles = this.getUserIamRoles(payload);
    return allowed.some((r) => roles.includes(r));
  },
};
