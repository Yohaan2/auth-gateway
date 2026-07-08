import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import { env } from "../config/env";

// ─── Tipos Keycloak ──────────────────────────────────────────────────────────

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
  bearerOnly?: boolean;
  serviceAccountsEnabled?: boolean;
  standardFlowEnabled?: boolean;
  implicitFlowEnabled?: boolean;
  directAccessGrantsEnabled?: boolean;
}

export interface KcSession {
  id: string;
  username?: string;
  userId?: string;
  ipAddress?: string;
  start?: number;
  lastAccess?: number;
  rememberMe?: boolean;
  clients?: Record<string, string>;
}

export interface KcGroup {
  id: string;
  name: string;
  path?: string;
  subGroups?: KcGroup[];
  attributes?: Record<string, string[]>;
}

export interface CreateGroupPayload {
  name: string;
  attributes?: Record<string, string[]>;
}

export interface UpdateGroupPayload {
  name?: string;
  attributes?: Record<string, string[]>;
}

export interface KcRoleMappings {
  realmMappings?: KcRole[];
  clientMappings?: Record<string, { id: string; client: string; mappings: KcRole[] }>;
}

export interface KcUserListParams {
  first?: number;
  max?: number;
  search?: string;
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  emailVerified?: boolean;
}

export interface CreateUserPayload {
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  emailVerified?: boolean;
  requiredActions?: string[];
  credentials?: Array<{ type: string; value: string; temporary: boolean }>;
  // Atributos personalizados del usuario (claims de la plantilla, tenant, etc.)
  attributes?: Record<string, string[]>;
}

export interface UpdateUserPayload {
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  emailVerified?: boolean;
  requiredActions?: string[];
}

export interface CreateClientPayload {
  clientId: string;
  name?: string;
  description?: string;
  enabled?: boolean;
  publicClient?: boolean;
  redirectUris?: string[];
  webOrigins?: string[];
  standardFlowEnabled?: boolean;
  serviceAccountsEnabled?: boolean;
  directAccessGrantsEnabled?: boolean;
}

export interface UpdateClientPayload extends Partial<CreateClientPayload> {}

export interface CreateRolePayload {
  name: string;
  description?: string;
}

export interface UpdateRolePayload {
  name?: string;
  description?: string;
}

// ─── Servicio ────────────────────────────────────────────────────────────────

class KeycloakAdminService {
  private http: AxiosInstance;
  private tokenCache: { value: string; expiresAt: number } | null = null;

  constructor() {
    const baseURL = env.KEYCLOAK_INTERNAL_URL || env.KEYCLOAK_URL;
    this.http = axios.create({ baseURL });
  }

  // Devuelve el access_token de la service account, renovándolo si está próximo a expirar
  private async getAdminToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && now < this.tokenCache.expiresAt - 30_000) {
      return this.tokenCache.value;
    }

    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.KEYCLOAK_SA_CLIENT_ID,
      client_secret: env.KEYCLOAK_SA_CLIENT_SECRET,
    });

    const { data } = await this.http.post<{ access_token: string; expires_in: number }>(
      `/realms/${env.KEYCLOAK_REALM}/protocol/openid-connect/token`,
      params.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    this.tokenCache = {
      value: data.access_token,
      expiresAt: now + data.expires_in * 1000,
    };

    return this.tokenCache.value;
  }

  private async req<T>(config: AxiosRequestConfig): Promise<T> {
    const token = await this.getAdminToken();
    const base = `/admin/realms/${env.KEYCLOAK_REALM}`;

    const { data } = await this.http.request<T>({
      ...config,
      url: `${base}${config.url}`,
      headers: { Authorization: `Bearer ${token}`, ...(config.headers ?? {}) },
    });
    return data;
  }

  // ─── Usuarios ─────────────────────────────────────────────────────────────

  listUsers(params: KcUserListParams = {}): Promise<KcUser[]> {
    return this.req({ method: "GET", url: "/users", params });
  }

  getUserCount(params: Omit<KcUserListParams, "first" | "max"> = {}): Promise<number> {
    return this.req({ method: "GET", url: "/users/count", params });
  }

  getUser(id: string): Promise<KcUser> {
    return this.req({ method: "GET", url: `/users/${id}` });
  }

  async createUser(payload: CreateUserPayload): Promise<string> {
    const token = await this.getAdminToken();
    const base = `/admin/realms/${env.KEYCLOAK_REALM}`;
    const resp = await this.http.post(`${base}/users`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // Keycloak devuelve 201 con Location header que contiene el ID
    const location = resp.headers["location"] as string;
    return location ? location.split("/").pop()! : "";
  }

  updateUser(id: string, payload: UpdateUserPayload): Promise<void> {
    return this.req({ method: "PUT", url: `/users/${id}`, data: payload });
  }

  deleteUser(id: string): Promise<void> {
    return this.req({ method: "DELETE", url: `/users/${id}` });
  }

  resetPassword(id: string, password: string, temporary = true): Promise<void> {
    return this.req({
      method: "PUT",
      url: `/users/${id}/reset-password`,
      data: { type: "password", value: password, temporary },
    });
  }

  getUserSessions(id: string): Promise<KcSession[]> {
    return this.req({ method: "GET", url: `/users/${id}/sessions` });
  }

  deleteUserSessions(id: string): Promise<void> {
    return this.req({ method: "DELETE", url: `/users/${id}/sessions` });
  }

  getUserRoleMappings(id: string): Promise<KcRoleMappings> {
    return this.req({ method: "GET", url: `/users/${id}/role-mappings` });
  }

  addRealmRolesToUser(userId: string, roles: KcRole[]): Promise<void> {
    return this.req({ method: "POST", url: `/users/${userId}/role-mappings/realm`, data: roles });
  }

  removeRealmRolesFromUser(userId: string, roles: KcRole[]): Promise<void> {
    return this.req({ method: "DELETE", url: `/users/${userId}/role-mappings/realm`, data: roles });
  }

  addClientRolesToUser(userId: string, clientUuid: string, roles: KcRole[]): Promise<void> {
    return this.req({
      method: "POST",
      url: `/users/${userId}/role-mappings/clients/${clientUuid}`,
      data: roles,
    });
  }

  removeClientRolesFromUser(userId: string, clientUuid: string, roles: KcRole[]): Promise<void> {
    return this.req({
      method: "DELETE",
      url: `/users/${userId}/role-mappings/clients/${clientUuid}`,
      data: roles,
    });
  }

  getUserGroups(id: string): Promise<KcGroup[]> {
    return this.req({ method: "GET", url: `/users/${id}/groups` });
  }

  sendVerificationEmail(id: string): Promise<void> {
    return this.req({ method: "PUT", url: `/users/${id}/send-verify-email` });
  }

  // ─── Clientes (Módulos) ───────────────────────────────────────────────────

  listClients(params: { search?: string; first?: number; max?: number; viewableOnly?: boolean } = {}): Promise<KcClient[]> {
    return this.req({ method: "GET", url: "/clients", params });
  }

  getClient(id: string): Promise<KcClient> {
    return this.req({ method: "GET", url: `/clients/${id}` });
  }

  async createClient(payload: CreateClientPayload): Promise<string> {
    const token = await this.getAdminToken();
    const base = `/admin/realms/${env.KEYCLOAK_REALM}`;
    const resp = await this.http.post(`${base}/clients`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const location = resp.headers["location"] as string;
    return location ? location.split("/").pop()! : "";
  }

  updateClient(id: string, payload: UpdateClientPayload): Promise<void> {
    return this.req({ method: "PUT", url: `/clients/${id}`, data: payload });
  }

  getClientSecret(id: string): Promise<{ type: string; value: string }> {
    return this.req({ method: "GET", url: `/clients/${id}/client-secret` });
  }

  getClientRoles(clientId: string): Promise<KcRole[]> {
    return this.req({ method: "GET", url: `/clients/${clientId}/roles` });
  }

  createClientRole(clientId: string, payload: CreateRolePayload): Promise<void> {
    return this.req({ method: "POST", url: `/clients/${clientId}/roles`, data: payload });
  }

  updateClientRole(clientId: string, roleName: string, payload: UpdateRolePayload): Promise<void> {
    return this.req({
      method: "PATCH",
      url: `/clients/${clientId}/roles/${encodeURIComponent(roleName)}`,
      data: payload,
    });
  }

  deleteClientRole(clientId: string, roleName: string): Promise<void> {
    return this.req({
      method: "DELETE",
      url: `/clients/${clientId}/roles/${encodeURIComponent(roleName)}`,
    });
  }

  getClientRoleUsers(clientId: string, roleName: string): Promise<KcUser[]> {
    return this.req({
      method: "GET",
      url: `/clients/${clientId}/roles/${encodeURIComponent(roleName)}/users`,
    });
  }

  // ─── Roles del Realm ─────────────────────────────────────────────────────

  listRealmRoles(): Promise<KcRole[]> {
    return this.req({ method: "GET", url: "/roles" });
  }

  getRealmRole(roleName: string): Promise<KcRole> {
    return this.req({ method: "GET", url: `/roles/${encodeURIComponent(roleName)}` });
  }

  createRealmRole(payload: CreateRolePayload): Promise<void> {
    return this.req({ method: "POST", url: "/roles", data: payload });
  }

  updateRealmRole(roleName: string, payload: UpdateRolePayload): Promise<void> {
    return this.req({
      method: "PUT",
      url: `/roles/${encodeURIComponent(roleName)}`,
      data: payload,
    });
  }

  deleteRealmRole(roleName: string): Promise<void> {
    return this.req({ method: "DELETE", url: `/roles/${encodeURIComponent(roleName)}` });
  }

  getRealmRoleComposites(roleName: string): Promise<KcRole[]> {
    return this.req({ method: "GET", url: `/roles/${encodeURIComponent(roleName)}/composites` });
  }

  getRealmRoleUsers(roleName: string): Promise<KcUser[]> {
    return this.req({ method: "GET", url: `/roles/${encodeURIComponent(roleName)}/users` });
  }

  // ─── Grupos ────────────────────────────────────────────────────

  listGroups(params: { search?: string; first?: number; max?: number } = {}): Promise<KcGroup[]> {
    return this.req({ method: "GET", url: "/groups", params });
  }

  getGroup(id: string): Promise<KcGroup> {
    return this.req({ method: "GET", url: `/groups/${id}` });
  }

  async createGroup(payload: CreateGroupPayload): Promise<string> {
    const token = await this.getAdminToken();
    const base = `/admin/realms/${env.KEYCLOAK_REALM}`;
    const resp = await this.http.post(`${base}/groups`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const location = resp.headers["location"] as string;
    return location ? location.split("/").pop()! : "";
  }

  async createSubGroup(parentId: string, payload: CreateGroupPayload): Promise<string> {
    const token = await this.getAdminToken();
    const base = `/admin/realms/${env.KEYCLOAK_REALM}`;
    const resp = await this.http.post(`${base}/groups/${parentId}/children`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const location = resp.headers["location"] as string;
    return location ? location.split("/").pop()! : "";
  }

  updateGroup(id: string, payload: UpdateGroupPayload): Promise<void> {
    return this.req({ method: "PUT", url: `/groups/${id}`, data: payload });
  }

  deleteGroup(id: string): Promise<void> {
    return this.req({ method: "DELETE", url: `/groups/${id}` });
  }

  getGroupMembers(id: string, params: { first?: number; max?: number } = {}): Promise<KcUser[]> {
    return this.req({ method: "GET", url: `/groups/${id}/members`, params });
  }

  addUserToGroup(userId: string, groupId: string): Promise<void> {
    return this.req({ method: "PUT", url: `/users/${userId}/groups/${groupId}` });
  }

  removeUserFromGroup(userId: string, groupId: string): Promise<void> {
    return this.req({ method: "DELETE", url: `/users/${userId}/groups/${groupId}` });
  }

  /**
   * Busca un grupo por su path exacto (ej. "/optrax-tenant-acme").
   * Recorre todos los grupos del realm de forma superficial.
   * Devuelve null si no se encuentra.
   */
  async getGroupByPath(path: string): Promise<KcGroup | null> {
    const groups = await this.listGroups();
    const normalized = path.startsWith("/") ? path : `/${path}`;
    const found = groups.find((g) => g.path === normalized || g.name === path);
    return found ?? null;
  }

  /** Añade un usuario a un grupo de Keycloak. */
  addUserToGroup(userId: string, groupId: string): Promise<void> {
    return this.req({ method: "PUT", url: `/users/${userId}/groups/${groupId}` });
  }

  /** Elimina un usuario de un grupo de Keycloak. */
  removeUserFromGroup(userId: string, groupId: string): Promise<void> {
    return this.req({ method: "DELETE", url: `/users/${userId}/groups/${groupId}` });
  }

  /**
   * Actualiza los atributos personalizados del usuario sin modificar otros campos.
   * Los atributos en Keycloak son Record<string, string[]>.
   */
  updateUserAttributes(userId: string, attributes: Record<string, string[]>): Promise<void> {
    // Se necesita el objeto completo del usuario para hacer el PUT sin sobreescribir otros campos
    return this.req({ method: "PUT", url: `/users/${userId}`, data: { attributes } });
  }

  /**
   * Envía el email de activación al usuario (execute-actions-email con UPDATE_PASSWORD).
   * Keycloak manda un email con un enlace para que el usuario establezca su contraseña.
   */
  sendActivationEmail(userId: string): Promise<void> {
    return this.req({
      method: "PUT",
      url: `/users/${userId}/execute-actions-email`,
      data: ["UPDATE_PASSWORD"],
    });
  }
}

export const kcAdmin = new KeycloakAdminService();
