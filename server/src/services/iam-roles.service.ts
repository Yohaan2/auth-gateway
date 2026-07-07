import type { KeycloakTokenPayload } from "../middleware/jwt-auth";
import {
  IAM_ROLES,
  ROLE_PERMISSIONS,
  isIamRole,
  type IamRole,
  type IamPermission,
} from "../config/iam-roles";

/**
 * Servicio encargado de consultar los roles administrativos del IAM
 * a partir del payload del JWT (access_token de Keycloak) del usuario
 * autenticado.
 */
export const iamRolesService = {
  /**
   * Extrae únicamente los roles administrativos del IAM presentes en
   * `realm_access.roles` del token, ignorando cualquier otro rol de realm
   * o de cliente que no pertenezca a esta matriz.
   */
  getUserIamRoles(payload?: KeycloakTokenPayload): IamRole[] {
    const realmRoles = payload?.realm_access?.roles ?? [];
    return realmRoles.filter(isIamRole);
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
