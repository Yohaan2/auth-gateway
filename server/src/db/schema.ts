import { pgTable, uuid, varchar, timestamp, json, boolean, text } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  keycloakId: varchar("keycloak_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Usuarios IAM (Fase 4) ────────────────────────────────────────────────────
//
// Fuente canónica de usuarios gestionados por el IAM. Registra la relación
// usuario-plantilla, el tenant asignado y el estado de aprovisionamiento.
// La tabla `users` existente es legacy (sesiones). Esta es la fuente de verdad
// para el flujo de creación/aprovisionamiento de Fase 4 en adelante.

export const iamUsers = pgTable("iam_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  keycloakId: varchar("keycloak_id", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  // Tenant: texto libre en esta fase. Se conectará al módulo de tenants en el futuro.
  tenant: varchar("tenant", { length: 255 }),
  // Plantilla de acceso asignada al usuario (puede ser null si no se aplicó plantilla).
  templateId: uuid("template_id").references(() => accessTemplates.id, { onDelete: "set null" }),
  enabled: boolean("enabled").default(true).notNull(),
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
export type TemplateClaim = typeof templateClaims.$inferSelect;
export type NewTemplateClaim = typeof templateClaims.$inferInsert;
export type TemplatePermission = typeof templatePermissions.$inferSelect;
export type NewTemplatePermission = typeof templatePermissions.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

// ─── Tipos Fase 4 (iam_users) ─────────────────────────────────────────────────
export type IamUser = typeof iamUsers.$inferSelect;
export type NewIamUser = typeof iamUsers.$inferInsert;
