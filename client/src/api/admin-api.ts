import axios from "axios";

// El cliente API envía el Bearer token en cada petición al backend Express
const api = axios.create({
  baseURL: "/api/admin",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// El token se inyecta desde fuera (setAuthToken) para evitar dependencias circulares
let currentToken: string | null = null;

export function setAuthToken(token: string | null) {
  currentToken = token;
}

api.interceptors.request.use((config) => {
  if (currentToken) {
    config.headers.Authorization = `Bearer ${currentToken}`;
  }
  return config;
});

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

export default api;
