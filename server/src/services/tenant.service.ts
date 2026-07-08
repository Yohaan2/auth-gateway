import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { tenants } from "../db/schema";
import { kcAdmin, type KcGroup, type KcUser } from "./keycloak-admin.service";

// ─── Tipos ────────────────────────────────────────────────────────────────────

/**
 * Vista unificada de un tenant: datos de Keycloak (fuente de verdad)
 * + metadatos extras almacenados en la DB.
 */
export interface TenantView {
  id: string;       // KC group ID — identificador canónico
  name: string;
  path: string;
  slug: string;     // Atributo "tenant_slug" del grupo KC
  attributes: Record<string, string[]>;
  // Metadatos DB
  description: string | null;
  active: boolean;
  settings: Record<string, unknown> | null;
  dbId: string | null;
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
 * Parsea los grupos del JWT para detectar si el usuario pertenece a algún tenant.
 * El usuario pertenece al grupo top-level del tenant directamente (sin sub-roles).
 *
 * Ejemplo: ["/Tenant A"] → { tenantName: "Tenant A" }
 */
export function parseTenantFromGroups(
  groups: string[]
): { tenantName: string } | null {
  for (const path of groups) {
    const parts = path.split("/").filter(Boolean);
    // Path de 1 nivel = pertenencia directa al grupo tenant
    if (parts.length === 1) {
      return { tenantName: parts[0] };
    }
  }
  return null;
}

function buildTenantView(
  group: KcGroup,
  meta: { id: string; description: string | null; active: boolean; settings: Record<string, unknown> | null } | null
): TenantView {
  const attrs = group.attributes ?? {};
  return {
    id: group.id,
    name: group.name,
    path: group.path ?? `/${group.name}`,
    slug: attrs["tenant_slug"]?.[0] ?? toSlug(group.name),
    attributes: attrs,
    description: meta?.description ?? null,
    active: meta?.active ?? true,
    settings: meta?.settings ?? null,
    dbId: meta?.id ?? null,
  };
}

const DEFAULT_PAGE_SIZE = 15;
const DEFAULT_MEMBERS_SIZE = 5;

// ─── Servicio ─────────────────────────────────────────────────────────────────

class TenantService {

  // ─── Listado paginado ─────────────────────────────────────────────────────

  async listTenants(params: { first?: number; max?: number } = {}): Promise<{
    tenants: TenantView[];
    total: number;
    hasMore: boolean;
  }> {
    const first = params.first ?? 0;
    const max = params.max ?? DEFAULT_PAGE_SIZE;

    const [kcGroups, countResult, dbRows] = await Promise.all([
      kcAdmin.listGroups({ first, max }),
      kcAdmin.countGroups(),
      db.select().from(tenants),
    ]);

    const dbMap = new Map(dbRows.map((t) => [t.keycloakGroupId, t]));
    const list = kcGroups.map((g) => buildTenantView(g, dbMap.get(g.id) ?? null));

    return {
      tenants: list,
      total: countResult.count,
      hasMore: first + list.length < countResult.count,
    };
  }

  // ─── Detalle ──────────────────────────────────────────────────────────────

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
   * Crea el grupo en Keycloak (sin sub-roles) y persiste metadatos en DB.
   */
  async createTenant(input: CreateTenantInput): Promise<TenantView> {
    const slug = input.slug?.trim() || toSlug(input.name);

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

    const group = await kcAdmin.getGroup(groupId);
    return buildTenantView(group, dbRow);
  }

  // ─── Actualizar ───────────────────────────────────────────────────────────

  async updateTenant(kcGroupId: string, input: UpdateTenantInput): Promise<TenantView | null> {
    let group: KcGroup;
    try {
      group = await kcAdmin.getGroup(kcGroupId);
    } catch {
      return null;
    }

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

  async deleteTenant(kcGroupId: string): Promise<boolean> {
    try {
      await kcAdmin.deleteGroup(kcGroupId);
    } catch {
      return false;
    }
    await db.delete(tenants).where(eq(tenants.keycloakGroupId, kcGroupId)).catch(() => {});
    return true;
  }

  // ─── Miembros ─────────────────────────────────────────────────────────────

  /**
   * Devuelve miembros directos del grupo tenant de forma paginada.
   * Por defecto devuelve los primeros `DEFAULT_MEMBERS_SIZE`.
   */
  async getTenantMembers(
    kcGroupId: string,
    params: { first?: number; max?: number } = {}
  ): Promise<{ members: KcUser[]; hasMore: boolean }> {
    const first = params.first ?? 0;
    const max = params.max ?? DEFAULT_MEMBERS_SIZE;

    // Pedimos max+1 para saber si hay más sin hacer una segunda llamada
    const raw = await kcAdmin.getGroupMembers(kcGroupId, { first, max: max + 1 });
    const hasMore = raw.length > max;
    return { members: raw.slice(0, max), hasMore };
  }

  /** Asigna un usuario al tenant (añade al grupo KC directamente). */
  async addUserToTenant(kcGroupId: string, userId: string): Promise<void> {
    await kcAdmin.addUserToGroup(userId, kcGroupId);
  }

  /**
   * Mueve a un usuario al tenant destino.
   * Usa los grupos del propio usuario para detectar su tenant actual,
   * evitando cargar todos los grupos del realm.
   */
  async moveUserToTenant(userId: string, targetTenantId: string): Promise<void> {
    const userGroups = await kcAdmin.getUserGroups(userId);

    // Los grupos tenant tienen path de profundidad 1: "/Tenant A"
    const tenantGroupsToLeave = userGroups.filter((g) => {
      if (!g.id || g.id === targetTenantId) return false;
      const depth = (g.path ?? "").split("/").filter(Boolean).length;
      return depth === 1;
    });

    await Promise.all(
      tenantGroupsToLeave.map((g) => kcAdmin.removeUserFromGroup(userId, g.id!).catch(() => {}))
    );

    await kcAdmin.addUserToGroup(userId, targetTenantId);
  }

  /** Saca al usuario del tenant (elimina del grupo KC). */
  async removeUserFromTenant(kcGroupId: string, userId: string): Promise<void> {
    await kcAdmin.removeUserFromGroup(userId, kcGroupId).catch(() => {});
  }
}

export const tenantService = new TenantService();
