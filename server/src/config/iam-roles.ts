/**
 * Roles administrativos globales del módulo IAM (Fase 1).
 *
 * Estos roles se definen como Realm Roles en Keycloak (ver
 * docker/keycloak-realm-export.json) y viajan dentro de `realm_access.roles`
 * en el Access Token (JWT) emitido por Keycloak.
 */
export const IAM_ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  IAM_ADMIN: "IAM_ADMIN",
  TENANT_ADMIN: "TENANT_ADMIN",
  AUDITOR: "AUDITOR",
} as const;

export type IamRole = (typeof IAM_ROLES)[keyof typeof IAM_ROLES];

export const ALL_IAM_ROLES: IamRole[] = Object.values(IAM_ROLES);

/**
 * Permisos administrativos disponibles en el módulo IAM.
 * En esta fase solo se define la infraestructura: qué permisos otorga
 * cada rol. El CRUD real (usuarios, tenants, plantillas) se implementa
 * en fases posteriores.
 */
export const IAM_PERMISSIONS = {
  MANAGE_USERS: "iam:manage_users",
  MANAGE_ROLES: "iam:manage_roles",
  MANAGE_TENANTS: "iam:manage_tenants",
  MANAGE_TEMPLATES: "iam:manage_templates",
  VIEW_AUDIT: "iam:view_audit",
  MANAGE_IAM_SETTINGS: "iam:manage_settings",
} as const;

export type IamPermission = (typeof IAM_PERMISSIONS)[keyof typeof IAM_PERMISSIONS];

/**
 * Matriz Rol -> Permisos. Fuente única de verdad para el RBAC del módulo IAM.
 */
export const ROLE_PERMISSIONS: Record<IamRole, IamPermission[]> = {
  [IAM_ROLES.SUPER_ADMIN]: Object.values(IAM_PERMISSIONS),
  [IAM_ROLES.IAM_ADMIN]: [
    IAM_PERMISSIONS.MANAGE_USERS,
    IAM_PERMISSIONS.MANAGE_ROLES,
    IAM_PERMISSIONS.VIEW_AUDIT,
  ],
  [IAM_ROLES.TENANT_ADMIN]: [IAM_PERMISSIONS.MANAGE_TENANTS],
  [IAM_ROLES.AUDITOR]: [IAM_PERMISSIONS.VIEW_AUDIT],
};

export function isIamRole(value: string): value is IamRole {
  return (ALL_IAM_ROLES as string[]).includes(value);
}
