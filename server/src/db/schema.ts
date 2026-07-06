import { pgTable, uuid, varchar, timestamp, json, boolean } from "drizzle-orm/pg-core";

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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
