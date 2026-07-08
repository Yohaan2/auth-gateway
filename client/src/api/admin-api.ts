import axios from "axios";

// El cliente API envía el Bearer token en cada petición al backend Express
const api = axios.create({
  baseURL: "/api/admin",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// Cliente dedicado al módulo IAM (roles administrativos, RBAC, /me)
export const iamApiClient = axios.create({
  baseURL: "/api/iam",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// El token se inyecta desde fuera (setAuthToken) para evitar dependencias circulares
let currentToken: string | null = null;

export function setAuthToken(token: string | null) {
  currentToken = token;
}

function attachAuthHeader(config: any) {
  if (currentToken) {
    config.headers.Authorization = `Bearer ${currentToken}`;
  }
  return config;
}

api.interceptors.request.use(attachAuthHeader);
iamApiClient.interceptors.request.use(attachAuthHeader);

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface KcUser {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  emailVerified: boolean;
  createdTimestamp?: number;
  requiredActions?: string[];
  attributes?: Record<string, string[]>;
}

export interface KcRole {
  id: string;
  name: string;
  description?: string;
  composite?: boolean;
  clientRole?: boolean;
  containerId?: string;
}

export interface KcClient {
  id: string;
  clientId: string;
  name?: string;
  description?: string;
  enabled: boolean;
  publicClient: boolean;
  protocol?: string;
  redirectUris?: string[];
  webOrigins?: string[];
}

export interface KcSession {
  id: string;
  username?: string;
  userId?: string;
  ipAddress?: string;
  start?: number;
  lastAccess?: number;
  clients?: Record<string, string>;
}

export interface KcRoleMappings {
  realmMappings?: KcRole[];
  clientMappings?: Record<string, { id: string; client: string; mappings: KcRole[] }>;
}

export interface DashboardStats {
  totalUsers: number;
  disabledUsers: number;
  totalModules: number;
  totalRealmRoles: number;
  recentUsers: KcUser[];
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const dashboardApi = {
  getStats: () => api.get<DashboardStats>("/dashboard").then((r) => r.data),
};

// ─── Usuarios ─────────────────────────────────────────────────────────────────

export interface ListUsersParams {
  first?: number;
  max?: number;
  search?: string;
  email?: string;
  username?: string;
  enabled?: boolean;
  emailVerified?: boolean;
}

export const usersApi = {
  list: (params: ListUsersParams = {}) =>
    api.get<{ users: KcUser[]; total: number }>("/users", { params }).then((r) => r.data),

  get: (id: string) => api.get<KcUser>(`/users/${id}`).then((r) => r.data),

  create: (payload: {
    username: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    enabled?: boolean;
    password?: string;
    temporaryPassword?: boolean;
    requiredActions?: string[];
  }) => api.post<{ id: string; message: string }>("/users", payload).then((r) => r.data),

  update: (
    id: string,
    payload: Partial<Pick<KcUser, "username" | "email" | "firstName" | "lastName" | "enabled" | "emailVerified" | "requiredActions">>
  ) => api.put(`/users/${id}`, payload).then((r) => r.data),

  delete: (id: string) => api.delete(`/users/${id}`).then((r) => r.data),

  resetPassword: (id: string, password: string, temporary = true) =>
    api.put(`/users/${id}/reset-password`, { password, temporary }).then((r) => r.data),

  verifyEmail: (id: string) => api.post(`/users/${id}/verify-email`).then((r) => r.data),

  getSessions: (id: string) => api.get<KcSession[]>(`/users/${id}/sessions`).then((r) => r.data),

  deleteSessions: (id: string) => api.delete(`/users/${id}/sessions`).then((r) => r.data),

  getRoles: (id: string) => api.get<KcRoleMappings>(`/users/${id}/roles`).then((r) => r.data),

  addRealmRoles: (id: string, roles: KcRole[]) =>
    api.post(`/users/${id}/roles/realm`, { roles }).then((r) => r.data),

  removeRealmRoles: (id: string, roles: KcRole[]) =>
    api.delete(`/users/${id}/roles/realm`, { data: { roles } }).then((r) => r.data),

  addClientRoles: (id: string, clientUuid: string, roles: KcRole[]) =>
    api.post(`/users/${id}/roles/clients/${clientUuid}`, { roles }).then((r) => r.data),

  removeClientRoles: (id: string, clientUuid: string, roles: KcRole[]) =>
    api.delete(`/users/${id}/roles/clients/${clientUuid}`, { data: { roles } }).then((r) => r.data),

  getGroups: (id: string) => api.get(`/users/${id}/groups`).then((r) => r.data),

  // ─── Fase 4 ────────────────────────────────────────────────────────

  /**
   * Crea un usuario con aprovisionamiento completo de plantilla.
   * Este es el endpoint principal de la Fase 4.
   */
  createProvisioned: (payload: CreateProvisionedUserPayload) =>
    api.post<{ id: string; iamUserId: string; message: string; templateApplied: boolean; activationEmailSent: boolean }>("/users", payload).then((r) => r.data),

  /** Obtiene el perfil IAM (DB local) del usuario, incluyendo plantilla asignada. */
  getIamProfile: (id: string) =>
    api.get<IamUserProfile>(`/users/${id}/iam-profile`).then((r) => r.data),

  /** Cambia la plantilla de acceso del usuario. Desasigna la anterior y aplica la nueva. */
  changeTemplate: (id: string, templateId: string) =>
    api.put<{ message: string }>(`/users/${id}/template`, { templateId }).then((r) => r.data),

  /** Reaaplica la plantilla actual al usuario (idempotente). */
  reapplyTemplate: (id: string) =>
    api.post<{ message: string }>(`/users/${id}/reapply-template`).then((r) => r.data),

  /** Sincroniza el estado del usuario entre Keycloak y la DB del IAM. */
  syncUser: (id: string) =>
    api.post<{ message: string }>(`/users/${id}/sync`).then((r) => r.data),

  /** Envía un email de activación al usuario. */
  sendActivationEmail: (id: string) =>
    api.post<{ message: string }>(`/users/${id}/activation-email`).then((r) => r.data),
};

// ─── Roles ────────────────────────────────────────────────────────────────────

export const rolesApi = {
  list: () => api.get<KcRole[]>("/roles").then((r) => r.data),

  create: (payload: { name: string; description?: string }) =>
    api.post("/roles", payload).then((r) => r.data),

  update: (roleName: string, payload: { name?: string; description?: string }) =>
    api.put(`/roles/${encodeURIComponent(roleName)}`, payload).then((r) => r.data),

  delete: (roleName: string) => api.delete(`/roles/${encodeURIComponent(roleName)}`).then((r) => r.data),

  getComposites: (roleName: string) =>
    api.get<KcRole[]>(`/roles/${encodeURIComponent(roleName)}/composites`).then((r) => r.data),

  getUsers: (roleName: string) =>
    api.get<KcUser[]>(`/roles/${encodeURIComponent(roleName)}/users`).then((r) => r.data),
};

// ─── Clientes (Módulos) ───────────────────────────────────────────────────────

export const clientsApi = {
  list: (params: { search?: string; showInternal?: boolean } = {}) =>
    api.get<KcClient[]>("/clients", { params }).then((r) => r.data),

  get: (id: string) => api.get<KcClient>(`/clients/${id}`).then((r) => r.data),

  create: (payload: {
    clientId: string;
    name?: string;
    description?: string;
    enabled?: boolean;
    publicClient?: boolean;
    redirectUris?: string[];
  }) => api.post<{ id: string; message: string }>("/clients", payload).then((r) => r.data),

  update: (id: string, payload: Partial<KcClient>) =>
    api.put(`/clients/${id}`, payload).then((r) => r.data),

  getRoles: (id: string) => api.get<KcRole[]>(`/clients/${id}/roles`).then((r) => r.data),

  createRole: (id: string, payload: { name: string; description?: string }) =>
    api.post(`/clients/${id}/roles`, payload).then((r) => r.data),

  updateRole: (id: string, roleName: string, payload: { name?: string; description?: string }) =>
    api.put(`/clients/${id}/roles/${encodeURIComponent(roleName)}`, payload).then((r) => r.data),

  deleteRole: (id: string, roleName: string) =>
    api.delete(`/clients/${id}/roles/${encodeURIComponent(roleName)}`).then((r) => r.data),

  getRoleUsers: (id: string, roleName: string) =>
    api.get<KcUser[]>(`/clients/${id}/roles/${encodeURIComponent(roleName)}/users`).then((r) => r.data),
};

// ─── Plantillas de Acceso (Access Templates) — Fase 3 ────────────────────────

export interface TemplateRoleInput {
  roleName: string;
  roleId?: string;
  isClientRole?: boolean;
  clientId?: string;
}

export interface TemplateGroupInput {
  groupId: string;
  groupPath: string;
}

export interface TemplateClaimInput {
  claimKey: string;
  claimValue: string;
}

export interface TemplatePermissionInput {
  resource: string;
  action: string;
  effect?: "allow" | "deny";
  description?: string;
}

export interface AccessTemplate {
  id: string;
  name: string;
  description?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccessTemplateDetail extends AccessTemplate {
  roles: (TemplateRoleInput & { id: string })[];
  groups: (TemplateGroupInput & { id: string })[];
  claims: (TemplateClaimInput & { id: string })[];
  permissions: (TemplatePermissionInput & { id: string })[];
}

export interface TemplatePayload {
  name: string;
  description?: string;
  active?: boolean;
  roles?: TemplateRoleInput[];
  groups?: TemplateGroupInput[];
  claims?: TemplateClaimInput[];
  permissions?: TemplatePermissionInput[];
}

// ─── Tipos Fase 4 ───────────────────────────────────────────────────────

/**
 * Payload para crear un usuario con aprovisionamiento completo (Fase 4).
 * Reemplaza el payload básico de Fase 1.
 */
export interface CreateProvisionedUserPayload {
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  /** Texto libre en esta fase. Se sustituirá por un selector de tenants en el futuro. */
  tenant?: string;
  /** UUID de la plantilla de acceso a aplicar al usuario. */
  templateId?: string;
  enabled?: boolean;
  /** Si true, Keycloak enviará un email al usuario para que establezca su contraseña. */
  sendActivationEmail?: boolean;
  /** Contraseña manual inicial */
  password?: string;
  /** Contraseña temporal (fuerza cambio en primer login) */
  temporaryPassword?: boolean;
}

/** Perfil IAM de un usuario (datos de la DB local del IAM). */
export interface IamUserProfile {
  id: string;
  keycloakId: string;
  username: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  tenant?: string | null;
  templateId?: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  /** Datos de la plantilla asignada. Null si no tiene plantilla. */
  template?: {
    id: string;
    name: string;
    description?: string | null;
    active: boolean;
  } | null;
}

export const templatesApi = {
  list: () => api.get<AccessTemplate[]>("/templates").then((r) => r.data),

  get: (id: string) => api.get<AccessTemplateDetail>(`/templates/${id}`).then((r) => r.data),

  create: (payload: TemplatePayload) =>
    api.post<AccessTemplateDetail>("/templates", payload).then((r) => r.data),

  update: (id: string, payload: Partial<TemplatePayload>) =>
    api.put<AccessTemplateDetail>(`/templates/${id}`, payload).then((r) => r.data),

  delete: (id: string) => api.delete(`/templates/${id}`).then((r) => r.data),

  listKeycloakRoles: () => api.get<KcRole[]>("/templates/keycloak/roles").then((r) => r.data),

  listKeycloakGroups: () =>
    api
      .get<{ id: string; name: string; path?: string }[]>("/templates/keycloak/groups")
      .then((r) => r.data),
};

// ─── Tenants (Grupos de Keycloak) — Fase 4 ───────────────────────────────────

export interface TenantSubGroup {
  id: string;
  name: string;
  path?: string;
}

export interface TenantView {
  id: string;           // KC group ID — identificador canónico
  name: string;
  path: string;
  slug: string;
  subGroups: TenantSubGroup[];
  attributes: Record<string, string[]>;
  description: string | null;
  active: boolean;
  settings: Record<string, unknown> | null;
  dbId: string | null;
}

export interface TenantMember extends KcUser {
  tenantRole: string;
}

export const tenantsApi = {
  list: () =>
    api.get<{ tenants: TenantView[]; total: number }>("/tenants").then((r) => r.data),

  get: (id: string) => api.get<TenantView>(`/tenants/${id}`).then((r) => r.data),

  create: (payload: { name: string; slug?: string; description?: string }) =>
    api.post<{ tenant: TenantView; message: string }>("/tenants", payload).then((r) => r.data),

  update: (id: string, payload: { name?: string; description?: string; active?: boolean }) =>
    api.put<{ tenant: TenantView; message: string }>(`/tenants/${id}`, payload).then((r) => r.data),

  delete: (id: string) => api.delete<{ message: string }>(`/tenants/${id}`).then((r) => r.data),

  getMembers: (id: string) =>
    api
      .get<{ members: TenantMember[]; total: number }>(`/tenants/${id}/members`)
      .then((r) => r.data),

  addMember: (id: string, userId: string, role: string) =>
    api.post<{ message: string }>(`/tenants/${id}/members`, { userId, role }).then((r) => r.data),

  updateMemberRole: (id: string, userId: string, role: string) =>
    api
      .put<{ message: string }>(`/tenants/${id}/members/${userId}/role`, { role })
      .then((r) => r.data),

  removeMember: (id: string, userId: string) =>
    api.delete<{ message: string }>(`/tenants/${id}/members/${userId}`).then((r) => r.data),

  availableRoles: () =>
    api.get<{ roles: string[] }>("/tenants/roles/available").then((r) => r.data),
};

// ─── IAM — Fase 1 (roles administrativos + RBAC) ────────────────────────────

export type IamRole = "SUPER_ADMIN" | "IAM_ADMIN" | "TENANT_ADMIN" | "AUDITOR";

export type IamPermission =
  | "iam:manage_users"
  | "iam:manage_roles"
  | "iam:manage_tenants"
  | "iam:manage_templates"
  | "iam:view_audit"
  | "iam:manage_settings";

export const IAM_PERMISSIONS = {
  MANAGE_USERS: "iam:manage_users" as const,
  MANAGE_ROLES: "iam:manage_roles" as const,
  MANAGE_TENANTS: "iam:manage_tenants" as const,
  MANAGE_TEMPLATES: "iam:manage_templates" as const,
  VIEW_AUDIT: "iam:view_audit" as const,
  MANAGE_IAM_SETTINGS: "iam:manage_settings" as const,
};

export interface IamMeResponse {
  user: {
    id: string;
    username?: string;
    email?: string;
    name?: string;
  };
  roles: IamRole[];
  permissions: IamPermission[];
  isSuperAdmin: boolean;
}

export const iamApi = {
  me: () => iamApiClient.get<IamMeResponse>("/me").then((r) => r.data),
};

export default api;
