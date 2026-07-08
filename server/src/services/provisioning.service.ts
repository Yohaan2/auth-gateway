import { eq } from "drizzle-orm";
import { db } from "../db/client";
import {
  iamUsers,
  accessTemplates,
  templateRoles,
  templateClaims,
} from "../db/schema";
import { kcAdmin } from "./keycloak-admin.service";
import { logAudit, type AuditEntry } from "../audit/audit.service";
import type { KeycloakTokenPayload } from "../middleware/jwt-auth";

// ─── Tipos de entrada ─────────────────────────────────────────────────────────

export interface CreateProvisionedUserInput {
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  /** ID del grupo Keycloak (tenant) al que asignar el usuario al crearlo. */
  tenantId?: string;
  /** UUID de la plantilla de acceso a aplicar. Opcional. */
  templateId?: string;
  enabled?: boolean;
  /** Si true, Keycloak enviará un email al usuario para que establezca su contraseña. */
  sendActivationEmail?: boolean;
  /** Contraseña inicial opcional */
  password?: string;
  /** Si la contraseña es temporal (fuerza cambio en primer login). Por defecto false. */
  temporaryPassword?: boolean;
}

export interface ProvisioningResult {
  keycloakId: string;
  iamUserId: string;
  username: string;
  templateApplied: boolean;
  activationEmailSent: boolean;
}

// ─── Servicio ────────────────────────────────────────────────────────────────

class ProvisioningService {
  /**
   * Crea un usuario en Keycloak y aplica la plantilla de acceso de forma
   * transaccional. Si falla cualquier paso de aprovisionamiento en Keycloak,
   * el usuario se elimina de Keycloak (rollback) y se lanza el error.
   * La persistencia en la DB del IAM solo ocurre si Keycloak está OK.
   */
  async createAndProvisionUser(
    input: CreateProvisionedUserInput,
    actor: KeycloakTokenPayload
  ): Promise<ProvisioningResult> {
    // ── 1. Crear el usuario en Keycloak ──────────────────────────────────────
    const userPayload: any = {
      username: input.username,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      enabled: input.enabled ?? true,
      emailVerified: false,
    };

    if (input.password) {
      userPayload.credentials = [
        {
          type: "password",
          value: input.password,
          temporary: input.temporaryPassword ?? false,
        },
      ];
    }

    const keycloakId = await kcAdmin.createUser(userPayload);

    if (!keycloakId) {
      throw new Error("Keycloak no devolvió un ID de usuario al crearlo.");
    }

    let templateApplied = false;
    let tenantName: string | null = null;

    try {
      // ── 2. Asignar al tenant (si se proporcionó el KC group ID) ──────────
      if (input.tenantId) {
        await kcAdmin.addUserToGroup(keycloakId, input.tenantId);
        // Obtener el nombre del tenant para guardarlo en iam_users
        const tenantGroup = await kcAdmin.getGroup(input.tenantId);
        tenantName = tenantGroup.name;
      }

      // ── 3. Aplicar la plantilla (si se proporcionó) ───────────────────────
      if (input.templateId) {
        await this.applyTemplateToUser(keycloakId, input.templateId, tenantName ?? undefined);
        templateApplied = true;
      }
    } catch (err) {
      // ── Rollback: eliminar el usuario de Keycloak si falla el aprovisionamiento
      try {
        await kcAdmin.deleteUser(keycloakId);
      } catch (rollbackErr) {
        console.error(`⚠️  Error al hacer rollback del usuario ${keycloakId} en Keycloak:`, rollbackErr);
      }
      throw new Error(
        `El aprovisionamiento falló y se revirtió la creación del usuario en Keycloak. Detalle: ${(err as Error).message}`
      );
    }

    // ── 3. Enviar email de activación (opcional, no bloquea el flujo principal) ──
    let activationEmailSent = false;
    if (input.sendActivationEmail) {
      try {
        await kcAdmin.sendActivationEmail(keycloakId);
        activationEmailSent = true;
      } catch (emailErr) {
        // El fallo de envío de email no revierte la creación del usuario
        console.error(`⚠️  No se pudo enviar el email de activación al usuario ${keycloakId}:`, emailErr);
      }
    }

    // ── 4. Persistir en la DB del IAM ────────────────────────────────────────
    const [iamUser] = await db
      .insert(iamUsers)
      .values({
        keycloakId,
        username: input.username,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        tenant: tenantName,
        templateId: input.templateId ?? null,
        enabled: input.enabled ?? true,
      })
      .returning();

    // ── 5. Auditoría ─────────────────────────────────────────────────────────
    const auditEntry: AuditEntry = {
      actor,
      action: "provision_user",
      entity: "iam_user",
      entityId: keycloakId,
      detail: {
        username: input.username,
        email: input.email,
        tenantId: input.tenantId,
        templateId: input.templateId,
        templateApplied,
        activationEmailSent,
      },
    };
    await logAudit(auditEntry);

    return {
      keycloakId,
      iamUserId: iamUser.id,
      username: iamUser.username,
      templateApplied,
      activationEmailSent,
    };
  }

  /**
   * Cambia la plantilla de un usuario. Desasigna los roles/grupos de la
   * plantilla anterior y aplica los de la nueva.
   */
  async changeTemplate(
    keycloakId: string,
    newTemplateId: string,
    actor: KeycloakTokenPayload
  ): Promise<void> {
    // Obtener el registro IAM actual
    const [iamUser] = await db
      .select()
      .from(iamUsers)
      .where(eq(iamUsers.keycloakId, keycloakId))
      .limit(1);

    if (!iamUser) {
      throw new Error("Usuario no encontrado en la base de datos del IAM.");
    }

    const previousTemplateId = iamUser.templateId;

    // Desasignar la plantilla anterior si existe
    if (previousTemplateId) {
      await this.removeTemplateFromUser(keycloakId, previousTemplateId);
    }

    // Aplicar la nueva plantilla
    await this.applyTemplateToUser(keycloakId, newTemplateId, iamUser.tenant ?? undefined);

    // Actualizar la DB
    await db
      .update(iamUsers)
      .set({ templateId: newTemplateId, updatedAt: new Date() })
      .where(eq(iamUsers.keycloakId, keycloakId));

    await logAudit({
      actor,
      action: "change_user_template",
      entity: "iam_user",
      entityId: keycloakId,
      detail: { previousTemplateId, newTemplateId },
    });
  }

  /**
   * Reaaplica la plantilla actual al usuario (idempotente).
   * Útil para resincronizar si el estado en Keycloak no coincide con la plantilla.
   */
  async reapplyTemplate(keycloakId: string, actor: KeycloakTokenPayload): Promise<void> {
    const [iamUser] = await db
      .select()
      .from(iamUsers)
      .where(eq(iamUsers.keycloakId, keycloakId))
      .limit(1);

    if (!iamUser) {
      throw new Error("Usuario no encontrado en la base de datos del IAM.");
    }

    if (!iamUser.templateId) {
      throw new Error("El usuario no tiene ninguna plantilla asignada.");
    }

    await this.applyTemplateToUser(keycloakId, iamUser.templateId, iamUser.tenant ?? undefined);

    await logAudit({
      actor,
      action: "reapply_user_template",
      entity: "iam_user",
      entityId: keycloakId,
      detail: { templateId: iamUser.templateId },
    });
  }

  /**
   * Sincroniza el usuario: lee el estado actual en Keycloak y actualiza la DB
   * del IAM para que refleje el estado real (enabled, email, etc.).
   */
  async syncUser(keycloakId: string, actor: KeycloakTokenPayload): Promise<void> {
    const kcUser = await kcAdmin.getUser(keycloakId);

    await db
      .update(iamUsers)
      .set({
        username: kcUser.username,
        email: kcUser.email,
        firstName: kcUser.firstName,
        lastName: kcUser.lastName,
        enabled: kcUser.enabled,
        updatedAt: new Date(),
      })
      .where(eq(iamUsers.keycloakId, keycloakId));

    await logAudit({
      actor,
      action: "sync_user",
      entity: "iam_user",
      entityId: keycloakId,
      detail: { syncedFields: ["username", "email", "firstName", "lastName", "enabled"] },
    });
  }

  /**
   * Obtiene el perfil IAM (DB) de un usuario por su ID de Keycloak.
   * Incluye los datos de la plantilla asignada.
   */
  async getIamProfile(keycloakId: string) {
    const [iamUser] = await db
      .select()
      .from(iamUsers)
      .where(eq(iamUsers.keycloakId, keycloakId))
      .limit(1);

    if (!iamUser) return null;

    let template = null;
    if (iamUser.templateId) {
      const [tpl] = await db
        .select()
        .from(accessTemplates)
        .where(eq(accessTemplates.id, iamUser.templateId))
        .limit(1);
      template = tpl ?? null;
    }

    return { ...iamUser, template };
  }

  // ─── Métodos privados ─────────────────────────────────────────────────────

  /**
   * Aplica una plantilla a un usuario en Keycloak:
   * 1. Grupos de la plantilla
   * 2. Roles de realm de la plantilla
   * 3. Roles de cliente de la plantilla
   * 4. Claims/atributos de la plantilla + tenant
   *
   * Todos los pasos se ejecutan de forma secuencial. Si alguno falla,
   * el error se propaga hacia arriba para que el caller pueda hacer rollback.
   */
  private async applyTemplateToUser(
    keycloakId: string,
    templateId: string,
    tenant?: string
  ): Promise<void> {
    // Cargar todos los elementos de la plantilla en paralelo
    const [roles, claims] = await Promise.all([
      db.select().from(templateRoles).where(eq(templateRoles.templateId, templateId)),
      db.select().from(templateClaims).where(eq(templateClaims.templateId, templateId)),
    ]);

    // ── Si hay tenant, intentar agregar al grupo de tenant en Keycloak ────────
    // Soft-fail: si el grupo no existe, se omite (no lanza error).
    if (tenant) {
      const tenantGroup = await kcAdmin.getGroupByPath(tenant);
      if (tenantGroup) {
        await kcAdmin.addUserToGroup(keycloakId, tenantGroup.id);
      } else {
        console.warn(`⚠️  No se encontró grupo en Keycloak para el tenant: "${tenant}". Se omite la asignación.`);
      }
    }

    // ── Asignar roles de la plantilla ─────────────────────────────────────────
    const realmRoles = roles.filter((r) => !r.isClientRole);
    const clientRoles = roles.filter((r) => r.isClientRole && r.clientId);

    if (realmRoles.length > 0) {
      // Resolver los roles de Keycloak por nombre para obtener el objeto completo {id, name}
      const resolvedRealmRoles = await Promise.all(
        realmRoles.map(async (r) => {
          try {
            return await kcAdmin.getRealmRole(r.roleName);
          } catch {
            console.warn(`⚠️  Rol de realm no encontrado en Keycloak: "${r.roleName}". Se omite.`);
            return null;
          }
        })
      );
      const validRoles = resolvedRealmRoles.filter(Boolean) as Awaited<ReturnType<typeof kcAdmin.getRealmRole>>[];
      if (validRoles.length > 0) {
        await kcAdmin.addRealmRolesToUser(keycloakId, validRoles);
      }
    }

    // Agrupar roles de cliente por clientId
    const rolesByClient = clientRoles.reduce<Record<string, typeof clientRoles>>((acc, r) => {
      const cid = r.clientId!;
      if (!acc[cid]) acc[cid] = [];
      acc[cid].push(r);
      return acc;
    }, {});

    for (const [clientId, cRoles] of Object.entries(rolesByClient)) {
      const resolvedClientRoles = await Promise.all(
        cRoles.map(async (r) => {
          try {
            const allClientRoles = await kcAdmin.getClientRoles(clientId);
            return allClientRoles.find((cr) => cr.name === r.roleName) ?? null;
          } catch {
            console.warn(`⚠️  No se pudieron obtener roles del cliente "${clientId}". Se omite.`);
            return null;
          }
        })
      );
      const validClientRoles = resolvedClientRoles.filter(Boolean) as Awaited<ReturnType<typeof kcAdmin.getClientRoles>>[number][];
      if (validClientRoles.length > 0) {
        await kcAdmin.addClientRolesToUser(keycloakId, clientId, validClientRoles);
      }
    }

    // ── Establecer atributos/claims de la plantilla ───────────────────────────
    const attributes: Record<string, string[]> = {};

    // Claims de la plantilla
    for (const claim of claims) {
      attributes[claim.claimKey] = [claim.claimValue];
    }

    // Tenant como atributo
    if (tenant) {
      attributes["tenant"] = [tenant];
    }

    if (Object.keys(attributes).length > 0) {
      await kcAdmin.updateUserAttributes(keycloakId, attributes);
    }
  }

  /**
   * Elimina la asignación de grupos y roles de una plantilla de un usuario.
   * Soft-fail: los errores se logean pero no interrumpen el flujo.
   */
  private async removeTemplateFromUser(keycloakId: string, templateId: string): Promise<void> {
    const [roles] = await Promise.all([
      db.select().from(templateRoles).where(eq(templateRoles.templateId, templateId)),
    ]);

    // Remover roles de realm
    const realmRoles = roles.filter((r) => !r.isClientRole);
    if (realmRoles.length > 0) {
      try {
        const resolvedRoles = await Promise.all(
          realmRoles.map(async (r) => {
            try { return await kcAdmin.getRealmRole(r.roleName); }
            catch { return null; }
          })
        );
        const valid = resolvedRoles.filter(Boolean) as Awaited<ReturnType<typeof kcAdmin.getRealmRole>>[];
        if (valid.length > 0) await kcAdmin.removeRealmRolesFromUser(keycloakId, valid);
      } catch (err) {
        console.warn(`⚠️  Error removiendo roles de realm del usuario ${keycloakId}:`, err);
      }
    }

    // Remover roles de cliente
    const clientRoles = roles.filter((r) => r.isClientRole && r.clientId);
    const rolesByClient = clientRoles.reduce<Record<string, typeof clientRoles>>((acc, r) => {
      const cid = r.clientId!;
      if (!acc[cid]) acc[cid] = [];
      acc[cid].push(r);
      return acc;
    }, {});

    for (const [clientId, cRoles] of Object.entries(rolesByClient)) {
      try {
        const allRoles = await kcAdmin.getClientRoles(clientId);
        const toRemove = allRoles.filter((cr) => cRoles.some((r) => r.roleName === cr.name));
        if (toRemove.length > 0) await kcAdmin.removeClientRolesFromUser(keycloakId, clientId, toRemove);
      } catch (err) {
        console.warn(`⚠️  Error removiendo roles de cliente "${clientId}":`, err);
      }
    }
  }
}

export const provisioningService = new ProvisioningService();
