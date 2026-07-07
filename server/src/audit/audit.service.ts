import { db } from "../db/client";
import { auditLogs } from "../db/schema";
import type { KeycloakTokenPayload } from "../middleware/jwt-auth";

export type AuditAction =
  | "create_user" | "update_user" | "delete_user" | "reset_password"
  | "enable_user" | "disable_user" | "revoke_sessions" | "verify_email"
  | "assign_realm_role" | "remove_realm_role"
  | "assign_client_role" | "remove_client_role"
  | "create_realm_role" | "update_realm_role" | "delete_realm_role"
  | "create_client" | "update_client" | "delete_client" | "enable_client" | "disable_client"
  | "create_client_role" | "update_client_role" | "delete_client_role"
  | "create_template" | "update_template" | "delete_template";

export type AuditEntity = "user" | "role" | "client" | "client_role" | "session" | "template";

export interface AuditEntry {
  actor: KeycloakTokenPayload;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  detail?: Record<string, unknown>;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorSub: entry.actor.sub,
      actorEmail: entry.actor.email,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      detail: entry.detail as any,
    });
  } catch (err) {
    // Los fallos de auditoría no deben interrumpir la operación principal
    console.error("⚠️  Error al registrar auditoría:", err);
  }
}
