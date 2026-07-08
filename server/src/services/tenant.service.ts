import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { tenants } from "../db/schema";
import { kcAdmin, type KcGroup, type KcUser } from "./keycloak-admin.service";

// ─── Constantes ───────────────────────────────────────────────────────────────

export const TENANT_DEFAULT_ROLES = ["Administradores", "Operadores", "Supervisores"] as const;
export type TenantRole = (typeof TENANT_DEFAULT_ROLES)[number];

// ─── Tipos ────────────────────────────────────────────────────────────────────

/**
 * Vista unificada de un tenant: datos de Keycloak (fuente de verdad)
 * + metadatos extra almacenados en la DB local.
 */
export interface TenantView {
  id: string;           // KC group ID — identificador canónico
  name: string;
  path: string;
  slug: string;         // Atributo "tenant_slug" del grupo KC
  subGroups: KcGroup[];
  attributes: Record<string, string[]>;
  // Metadatos DB
  description: string | null;
  active: boolean;
  settings: Record<string, unknown> | null;
  dbId: string | null;  // UUID interno de la DB (null si no existe registro)
}

export interface CreateTenantInput {
  name: string;
  slug?: string;
  description?: string;
  settings?: Record<string, unknown>;
}

export interface UpdateTenantInput {
  name?: string;
  description?: string;
  active?: boolean;
  settings?: Record<string, unknown>;
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

/** Convierte un nombre a slug válido (minúsculas, guiones). */
export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/**
 * Parsea las rutas de grupos del JWT para extraer el tenant y el rol
 * del usuario dentro de él.
 *
 * Ejemplo: ["/Tenant A/Operadores"] → { tenantName: "Tenant A", role: "Operadores" }
 */
export function parseTenantFromGroups(groups: string[]): {
  tenantName: string;
  role: TenantRole;
} | null {
  for (const path of groups) {
    const parts = path.split("/").filter(Boolean);
    if (parts.length === 2 && (TENANT_DEFAULT_ROLES as readonly string[]).includes(parts[1])) {
      return { tenantName: parts[0], role: parts[1] as TenantRole };
    }
  }
  return null;
}

/** Combina un KcGroup con los metadatos de la DB para producir un TenantView. */
function buildTenantView(
  group: KcGroup,
  meta: { id: string; description: string | null; active: boolean; settings: Record<string, unknown> | null } | null
): TenantView {
  const attrs = group.attributes ?? {};
  const slug = attrs["tenant_slug"]?.[0] ?? toSlug(group.name);

  return {
    id: group.id,
    name: group.name,
    path: group.path ?? `/${group.name}`,
    slug,
    subGroups: group.subGroups ?? [],
    attributes: attrs,
    description: meta?.description ?? null,
    active: meta?.active ?? true,
    settings: meta?.settings ?? null,
    dbId: meta?.id ?? null,
  };
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

class TenantService {

  // ─── Listado ──────────────────────────────────────────────────────────────

  /**
   * Fuente de verdad: grupos top-level de Keycloak.
   * Enriquece cada grupo con los metadatos de la DB si existen.
   */
  async listTenants(): Promise<TenantView[]> {
    const [kcGroups, dbRows] = await Promise.all([
      kcAdmin.listGroups({ max: 500 }),
      db.select().from(tenants),
    ]);

    const dbMap = new Map(dbRows.map((t) => [t.keycloakGroupId, t]));

    return kcGroups.map((g) => buildTenantView(g, dbMap.get(g.id) ?? null));
  }

  // ─── Detalle ──────────────────────────────────────────────────────────────

  /**
   * Obtiene un tenant por su KC group ID.
   * Incluye sub-grupos completos desde Keycloak.
   */
  async getTenant(kcGroupId: string): Promise<TenantView | null> {
    let group: KcGroup;
    try {
      group = await kcAdmin.getGroup(kcGroupId);
    } catch {
      return null;
    }

    const [meta] = await db.select().from(tenants).where(eq(tenants.keycloakGroupId, kcGroupId));
    return buildTenantView(group, meta ?? null);
  }

  // ─── Crear ────────────────────────────────────────────────────────────────

  /**
   * 1. Crea el grupo en Keycloak con el atributo `tenant_slug`.
   * 2. Crea los 3 sub-grupos estándar (Administradores, Operadores, Supervisores).
   * 3. Guarda metadatos extras en la DB (upsert por keycloak_group_id).
   */
  async createTenant(input: CreateTenantInput): Promise<TenantView> {
    const slug = input.slug?.trim() || toSlug(input.name);

    // 1. Crear grupo principal en KC
    const groupId = await kcAdmin.createGroup({
      name: input.name.trim(),
      attributes: {
        tenant_slug: [slug],
        tenant_display_name: [input.name.trim()],
      },
    });

    if (!groupId) {
      throw new Error("Keycloak no devolvió un ID de grupo válido.");
    }

    // 2. Crear sub-grupos en paralelo
    await Promise.all(
      TENANT_DEFAULT_ROLES.map((role) => kcAdmin.createSubGroup(groupId, { name: role }))
    );

    // 3. Persistir metadatos en la DB
    const [dbRow] = await db
      .insert(tenants)
      .values({
        keycloakGroupId: groupId,
        name: input.name.trim(),
        slug,
        description: input.description ?? null,
        settings: input.settings ?? null,
      })
      .returning();

    // 4. Leer el grupo recién creado de KC (incluye sub-grupos)
    const group = await kcAdmin.getGroup(groupId);
    return buildTenantView(group, dbRow);
  }

  // ─── Actualizar ───────────────────────────────────────────────────────────

  /**
   * Actualiza nombre en KC y metadatos en la DB.
   * Si no existe registro DB para el tenant, lo crea (upsert).
   */
  async updateTenant(kcGroupId: string, input: UpdateTenantInput): Promise<TenantView | null> {
    let group: KcGroup;
    try {
      group = await kcAdmin.getGroup(kcGroupId);
    } catch {
      return null;
    }

    // Actualizar nombre en KC si cambió
    if (input.name && input.name.trim() !== group.name) {
      const currentSlug = group.attributes?.["tenant_slug"]?.[0] ?? toSlug(group.name);
      await kcAdmin.updateGroup(kcGroupId, {
        name: input.name.trim(),
        attributes: {
          tenant_slug: [currentSlug],
          tenant_display_name: [input.name.trim()],
        },
      });
      group = await kcAdmin.getGroup(kcGroupId);
    }

    // Upsert metadatos en DB
    const [existing] = await db.select().from(tenants).where(eq(tenants.keycloakGroupId, kcGroupId));
    let meta: typeof existing;

    if (existing) {
      const [updated] = await db
        .update(tenants)
        .set({
          ...(input.name && { name: input.name.trim() }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.active !== undefined && { active: input.active }),
          ...(input.settings !== undefined && { settings: input.settings }),
          updatedAt: new Date(),
        })
        .where(eq(tenants.keycloakGroupId, kcGroupId))
        .returning();
      meta = updated;
    } else {
      const [inserted] = await db
        .insert(tenants)
        .values({
          keycloakGroupId: kcGroupId,
          name: input.name?.trim() ?? group.name,
          slug: group.attributes?.["tenant_slug"]?.[0] ?? toSlug(group.name),
          description: input.description ?? null,
          active: input.active ?? true,
          settings: input.settings ?? null,
        })
        .returning();
      meta = inserted;
    }

    return buildTenantView(group, meta);
  }

  // ─── Eliminar ─────────────────────────────────────────────────────────────

  /**
   * Elimina el grupo en KC (sub-grupos y membresías se eliminan en cascada),
   * luego limpia el registro de metadatos de la DB.
   */
  async deleteTenant(kcGroupId: string): Promise<boolean> {
    try {
      await kcAdmin.deleteGroup(kcGroupId);
    } catch {
      return false;
    }

    // Limpiar metadatos (si existen)
    await db.delete(tenants).where(eq(tenants.keycloakGroupId, kcGroupId)).catch(() => {});

    return true;
  }

  // ─── Miembros ─────────────────────────────────────────────────────────────

  /**
   * Devuelve todos los usuarios de los sub-grupos del tenant anotando
   * en qué sub-grupo (rol) está cada uno.
   */
  async getTenantMembers(
    kcGroupId: string
  ): Promise<Array<KcUser & { tenantRole: string }>> {
    const group = await kcAdmin.getGroup(kcGroupId);
    const subGroups = group.subGroups ?? [];

    const results: Array<KcUser & { tenantRole: string }> = [];

    await Promise.all(
      subGroups.map(async (sg) => {
        if (!sg.id) return;
        const members = await kcAdmin.getGroupMembers(sg.id, { max: 500 });
        for (const m of members) {
          results.push({ ...m, tenantRole: sg.name });
        }
      })
    );

    return results;
  }

  /**
   * Asigna un usuario a un sub-grupo del tenant.
   * Lo mueve automáticamente si ya estaba en otro sub-grupo del mismo tenant.
   */
  async addUserToTenant(
    kcGroupId: string,
    userId: string,
    role: TenantRole
  ): Promise<void> {
    const group = await kcAdmin.getGroup(kcGroupId);
    const subGroups = group.subGroups ?? [];

    const target = subGroups.find((sg) => sg.name === role);
    if (!target?.id) {
      throw new Error(`Sub-grupo "${role}" no encontrado en el tenant.`);
    }

    // Sacar de otros sub-grupos del mismo tenant primero
    await Promise.all(
      subGroups
        .filter((sg) => sg.id && sg.name !== role)
        .map((sg) => kcAdmin.removeUserFromGroup(userId, sg.id!).catch(() => {}))
    );

    await kcAdmin.addUserToGroup(userId, target.id);
  }

  /** Alias semántico para mover entre sub-grupos. */
  async updateUserTenantRole(
    kcGroupId: string,
    userId: string,
    newRole: TenantRole
  ): Promise<void> {
    return this.addUserToTenant(kcGroupId, userId, newRole);
  }

  /** Elimina al usuario de todos los sub-grupos del tenant. */
  async removeUserFromTenant(kcGroupId: string, userId: string): Promise<void> {
    const group = await kcAdmin.getGroup(kcGroupId);
    await Promise.all(
      (group.subGroups ?? [])
        .filter((sg) => sg.id)
        .map((sg) => kcAdmin.removeUserFromGroup(userId, sg.id!).catch(() => {}))
    );
  }
}

export const tenantService = new TenantService();
