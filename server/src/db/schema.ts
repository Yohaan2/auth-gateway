import { pgTable, uuid, varchar, timestamp, json, boolean, text } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  keycloakId: varchar("keycloak_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorSub: varchar("actor_sub", { length: 255 }).notNull(),
  actorEmail: varchar("actor_email", { length: 255 }),
  action: varchar("action", { length: 100 }).notNull(),
  entity: varchar("entity", { length: 100 }).notNull(),
  entityId: varchar("entity_id", { length: 255 }),
  detail: json("detail"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Clientes registrados para usar el gateway de login
export const gatewayClients = pgTable("gateway_clients", {
  clientId: varchar("client_id", { length: 255 }).primaryKey(),
  clientSecret: varchar("client_secret", { length: 500 }).notNull(),
  name: varchar("name", { length: 255 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type GatewayClient = typeof gatewayClients.$inferSelect;

// ─── Plantillas de Acceso (Access Templates) — Fase 3 ────────────────────────
//
// Modelo normalizado: una plantilla (`accessTemplates`) agrupa roles de
// Keycloak, grupos/organizaciones, claims/atributos personalizados y
// permisos finos. En esta fase solo se administran las plantillas: no se
// asignan a usuarios ni se modifica nada en Keycloak.

export const accessTemplates = pgTable("access_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Roles de Keycloak (realm o de cliente) asociados a una plantilla
export const templateRoles = pgTable("template_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => accessTemplates.id, { onDelete: "cascade" }),
  roleName: varchar("role_name", { length: 255 }).notNull(),
  roleId: varchar("role_id", { length: 255 }), // ID interno del rol en Keycloak
  isClientRole: boolean("is_client_role").default(false).notNull(),
  clientId: varchar("client_id", { length: 255 }), // UUID del cliente en Keycloak, si aplica
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Grupos/Organizaciones de Keycloak asociados a una plantilla
export const templateGroups = pgTable("template_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => accessTemplates.id, { onDelete: "cascade" }),
  groupId: varchar("group_id", { length: 255 }).notNull(), // ID del grupo en Keycloak
  groupPath: varchar("group_path", { length: 500 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Claims / atributos personalizados (key/value) de una plantilla
export const templateClaims = pgTable("template_claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => accessTemplates.id, { onDelete: "cascade" }),
  claimKey: varchar("claim_key", { length: 255 }).notNull(),
  claimValue: text("claim_value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Permisos finos de una plantilla. Solo se almacenan en esta fase, sin
// evaluarse en tiempo de ejecución (se usarán en fases posteriores).
export const templatePermissions = pgTable("template_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => accessTemplates.id, { onDelete: "cascade" }),
  resource: varchar("resource", { length: 255 }).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  effect: varchar("effect", { length: 20 }).default("allow").notNull(), // "allow" | "deny"
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AccessTemplate = typeof accessTemplates.$inferSelect;
export type NewAccessTemplate = typeof accessTemplates.$inferInsert;
export type TemplateRole = typeof templateRoles.$inferSelect;
export type NewTemplateRole = typeof templateRoles.$inferInsert;
export type TemplateGroup = typeof templateGroups.$inferSelect;
export type NewTemplateGroup = typeof templateGroups.$inferInsert;
export type TemplateClaim = typeof templateClaims.$inferSelect;
export type NewTemplateClaim = typeof templateClaims.$inferInsert;
export type TemplatePermission = typeof templatePermissions.$inferSelect;
export type NewTemplatePermission = typeof templatePermissions.$inferInsert;

// ─── Tenants — Fase 4: Multitenancy ──────────────────────────────────────────
//
// Cada tenant espeja un Group de Keycloak. La estructura de sub-grupos
// (Administradores / Operadores / Supervisores) se gestiona directamente
// en Keycloak; aquí solo guardamos los metadatos y la referencia al grupo.

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  keycloakGroupId: varchar("keycloak_group_id", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  active: boolean("active").default(true).notNull(),
  settings: json("settings").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
