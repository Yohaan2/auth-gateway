import { eq } from "drizzle-orm";
import { db } from "../db/client";
import {
  accessTemplates,
  templateRoles,
  templateClaims,
  templatePermissions,
} from "../db/schema";

// ─── Tipos de entrada ─────────────────────────────────────────────────────────

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

export interface CreateTemplateInput {
  name: string;
  description?: string;
  active?: boolean;
  roles?: TemplateRoleInput[];
  groups?: TemplateGroupInput[];
  claims?: TemplateClaimInput[];
  permissions?: TemplatePermissionInput[];
}

export type UpdateTemplateInput = Partial<CreateTemplateInput>;

// ─── Servicio ────────────────────────────────────────────────────────────────

class TemplatesService {
  /** Lista todas las plantillas (sin sus relaciones, para vistas de listado). */
  async list() {
    return db.select().from(accessTemplates).orderBy(accessTemplates.name);
  }

  /** Obtiene una plantilla junto con todos sus elementos asociados. */
  async getById(id: string) {
    const [template] = await db
      .select()
      .from(accessTemplates)
      .where(eq(accessTemplates.id, id))
      .limit(1);

    if (!template) return null;

    const [roles, claims, permissions] = await Promise.all([
      db.select().from(templateRoles).where(eq(templateRoles.templateId, id)),
      db.select().from(templateClaims).where(eq(templateClaims.templateId, id)),
      db.select().from(templatePermissions).where(eq(templatePermissions.templateId, id)),
    ]);

    return { ...template, roles, claims, permissions };
  }

  /** Crea una plantilla junto con sus roles/grupos/claims/permisos iniciales. */
  async create(input: CreateTemplateInput) {
    return db.transaction(async (tx) => {
      const [template] = await tx
        .insert(accessTemplates)
        .values({
          name: input.name,
          description: input.description,
          active: input.active ?? true,
        })
        .returning();

      await this.replaceChildren(tx, template.id, input);

      return template;
    });
  }

  /** Actualiza los datos base de la plantilla y, si se proveen, reemplaza sus elementos asociados. */
  async update(id: string, input: UpdateTemplateInput) {
    return db.transaction(async (tx) => {
      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) updateValues.name = input.name;
      if (input.description !== undefined) updateValues.description = input.description;
      if (input.active !== undefined) updateValues.active = input.active;

      const [template] = await tx
        .update(accessTemplates)
        .set(updateValues)
        .where(eq(accessTemplates.id, id))
        .returning();

      if (!template) return null;

      await this.replaceChildren(tx, id, input);

      return template;
    });
  }

  /** Elimina una plantilla (los elementos asociados se eliminan en cascada). */
  async delete(id: string) {
    const [deleted] = await db
      .delete(accessTemplates)
      .where(eq(accessTemplates.id, id))
      .returning();
    return deleted ?? null;
  }

  /**
   * Reemplaza los roles/grupos/claims/permisos de una plantilla cuando se
   * proveen explícitamente en el payload (crear o editar).
   */
  private async replaceChildren(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    templateId: string,
    input: CreateTemplateInput | UpdateTemplateInput
  ) {
    if (input.roles !== undefined) {
      await tx.delete(templateRoles).where(eq(templateRoles.templateId, templateId));
      if (input.roles.length > 0) {
        await tx.insert(templateRoles).values(
          input.roles.map((r) => ({
            templateId,
            roleName: r.roleName,
            roleId: r.roleId,
            isClientRole: r.isClientRole ?? false,
            clientId: r.clientId,
          }))
        );
      }
    }

    if (input.claims !== undefined) {
      await tx.delete(templateClaims).where(eq(templateClaims.templateId, templateId));
      if (input.claims.length > 0) {
        await tx.insert(templateClaims).values(
          input.claims.map((c) => ({
            templateId,
            claimKey: c.claimKey,
            claimValue: c.claimValue,
          }))
        );
      }
    }

    if (input.permissions !== undefined) {
      await tx.delete(templatePermissions).where(eq(templatePermissions.templateId, templateId));
      if (input.permissions.length > 0) {
        await tx.insert(templatePermissions).values(
          input.permissions.map((p) => ({
            templateId,
            resource: p.resource,
            action: p.action,
            effect: p.effect ?? "allow",
            description: p.description,
          }))
        );
      }
    }
  }
}

export const templatesService = new TemplatesService();
