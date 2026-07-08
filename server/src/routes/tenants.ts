import { Router } from "express";
import { requireJwt } from "../middleware/jwt-auth";
import { Permissions } from "../common/decorators/roles.decorator";
import { IAM_PERMISSIONS } from "../config/iam-roles";
import {
  tenantService,
  TENANT_DEFAULT_ROLES,
  type TenantRole,
  toSlug,
} from "../services/tenant.service";
import { logAudit } from "../audit/audit.service";
import { sensitiveLimiter } from "../middleware/rate-limiter";

const router = Router();
router.use(requireJwt);

// ─── Roles disponibles ────────────────────────────────────────────────────────
// IMPORTANTE: este endpoint debe ir ANTES de /:id para que Express no lo trate
// como un parámetro dinámico.

/**
 * GET /api/admin/tenants/roles/available
 */
router.get("/roles/available", Permissions(IAM_PERMISSIONS.MANAGE_TENANTS), (_req, res) => {
  res.json({ roles: TENANT_DEFAULT_ROLES });
});

// ─── Listar tenants ───────────────────────────────────────────────────────────

/**
 * GET /api/admin/tenants
 *
 * Fuente de verdad: grupos top-level de Keycloak.
 * Enriquece cada grupo con metadatos de la DB local si existen.
 */
router.get("/", Permissions(IAM_PERMISSIONS.MANAGE_TENANTS), async (_req, res, next) => {
  try {
    const list = await tenantService.listTenants();
    res.json({ tenants: list, total: list.length });
  } catch (err) {
    next(err);
  }
});

// ─── Crear tenant ─────────────────────────────────────────────────────────────

/**
 * POST /api/admin/tenants
 * Body: { name, slug?, description?, settings? }
 *
 * Crea el grupo en Keycloak (con sub-grupos Administradores / Operadores /
 * Supervisores) y guarda metadatos en la DB.
 */
router.post(
  "/",
  Permissions(IAM_PERMISSIONS.MANAGE_TENANTS),
  sensitiveLimiter,
  async (req, res, next) => {
    try {
      const { name, slug, description, settings } = req.body as {
        name?: string;
        slug?: string;
        description?: string;
        settings?: Record<string, unknown>;
      };

      if (!name?.trim()) {
        return res.status(400).json({ error: "El campo 'name' es obligatorio." });
      }

      const tenant = await tenantService.createTenant({
        name: name.trim(),
        slug: slug?.trim() || toSlug(name.trim()),
        description: description?.trim(),
        settings,
      });

      await logAudit({
        actor: req.jwtPayload!,
        action: "create_tenant",
        entity: "tenant",
        entityId: tenant.id,       // KC group ID
        detail: { name: tenant.name, slug: tenant.slug },
      });

      res.status(201).json({ tenant, message: "Tenant creado exitosamente." });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Detalle de tenant ────────────────────────────────────────────────────────

/**
 * GET /api/admin/tenants/:kcGroupId
 *
 * :kcGroupId = ID del grupo en Keycloak (UUID de KC).
 */
router.get("/:kcGroupId", Permissions(IAM_PERMISSIONS.MANAGE_TENANTS), async (req, res, next) => {
  try {
    const tenant = await tenantService.getTenant(req.params.kcGroupId);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant no encontrado." });
    }
    res.json(tenant);
  } catch (err) {
    next(err);
  }
});

// ─── Actualizar tenant ────────────────────────────────────────────────────────

/**
 * PUT /api/admin/tenants/:kcGroupId
 * Body: { name?, description?, active?, settings? }
 *
 * Actualiza el grupo en Keycloak y los metadatos en la DB.
 * Si no existía registro en DB, lo crea (upsert).
 */
router.put("/:kcGroupId", Permissions(IAM_PERMISSIONS.MANAGE_TENANTS), async (req, res, next) => {
  try {
    const { name, description, active, settings } = req.body;

    const updated = await tenantService.updateTenant(req.params.kcGroupId, {
      name,
      description,
      active,
      settings,
    });

    if (!updated) {
      return res.status(404).json({ error: "Tenant no encontrado en Keycloak." });
    }

    await logAudit({
      actor: req.jwtPayload!,
      action: "update_tenant",
      entity: "tenant",
      entityId: req.params.kcGroupId,
      detail: req.body,
    });

    res.json({ tenant: updated, message: "Tenant actualizado." });
  } catch (err) {
    next(err);
  }
});

// ─── Eliminar tenant ──────────────────────────────────────────────────────────

/**
 * DELETE /api/admin/tenants/:kcGroupId
 *
 * Elimina el grupo de Keycloak (sub-grupos y membresías en cascada)
 * y el registro de metadatos de la DB.
 */
router.delete(
  "/:kcGroupId",
  Permissions(IAM_PERMISSIONS.MANAGE_TENANTS),
  sensitiveLimiter,
  async (req, res, next) => {
    try {
      const deleted = await tenantService.deleteTenant(req.params.kcGroupId);
      if (!deleted) {
        return res.status(404).json({ error: "Tenant no encontrado en Keycloak." });
      }

      await logAudit({
        actor: req.jwtPayload!,
        action: "delete_tenant",
        entity: "tenant",
        entityId: req.params.kcGroupId,
      });

      res.json({ message: "Tenant eliminado." });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Miembros del tenant ──────────────────────────────────────────────────────

/**
 * GET /api/admin/tenants/:kcGroupId/members
 *
 * Devuelve todos los usuarios de los sub-grupos del tenant
 * con su rol dentro de él (Administradores / Operadores / Supervisores).
 */
router.get(
  "/:kcGroupId/members",
  Permissions(IAM_PERMISSIONS.MANAGE_TENANTS),
  async (req, res, next) => {
    try {
      const members = await tenantService.getTenantMembers(req.params.kcGroupId);
      res.json({ members, total: members.length });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/admin/tenants/:kcGroupId/members
 * Body: { userId, role: "Administradores" | "Operadores" | "Supervisores" }
 *
 * Asigna un usuario al tenant con el rol indicado.
 * Si ya estaba en otro sub-grupo del mismo tenant, lo mueve.
 */
router.post(
  "/:kcGroupId/members",
  Permissions(IAM_PERMISSIONS.MANAGE_TENANTS),
  async (req, res, next) => {
    try {
      const { userId, role } = req.body as { userId?: string; role?: string };

      if (!userId) {
        return res.status(400).json({ error: "El campo 'userId' es obligatorio." });
      }
      if (!role || !(TENANT_DEFAULT_ROLES as readonly string[]).includes(role)) {
        return res.status(400).json({
          error: `'role' debe ser uno de: ${TENANT_DEFAULT_ROLES.join(", ")}.`,
        });
      }

      await tenantService.addUserToTenant(req.params.kcGroupId, userId, role as TenantRole);

      await logAudit({
        actor: req.jwtPayload!,
        action: "add_tenant_member",
        entity: "tenant_member",
        entityId: req.params.kcGroupId,
        detail: { userId, role },
      });

      res.status(201).json({ message: `Usuario agregado al tenant como ${role}.` });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/admin/tenants/:kcGroupId/members/:userId/role
 * Body: { role: "Administradores" | "Operadores" | "Supervisores" }
 *
 * Mueve al usuario a un sub-grupo diferente dentro del mismo tenant.
 */
router.put(
  "/:kcGroupId/members/:userId/role",
  Permissions(IAM_PERMISSIONS.MANAGE_TENANTS),
  async (req, res, next) => {
    try {
      const { role } = req.body as { role?: string };

      if (!role || !(TENANT_DEFAULT_ROLES as readonly string[]).includes(role)) {
        return res.status(400).json({
          error: `'role' debe ser uno de: ${TENANT_DEFAULT_ROLES.join(", ")}.`,
        });
      }

      await tenantService.updateUserTenantRole(
        req.params.kcGroupId,
        req.params.userId,
        role as TenantRole
      );

      await logAudit({
        actor: req.jwtPayload!,
        action: "update_tenant_member_role",
        entity: "tenant_member",
        entityId: req.params.kcGroupId,
        detail: { userId: req.params.userId, newRole: role },
      });

      res.json({ message: `Rol actualizado a ${role}.` });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/admin/tenants/:kcGroupId/members/:userId
 *
 * Saca al usuario de todos los sub-grupos del tenant.
 */
router.delete(
  "/:kcGroupId/members/:userId",
  Permissions(IAM_PERMISSIONS.MANAGE_TENANTS),
  async (req, res, next) => {
    try {
      await tenantService.removeUserFromTenant(req.params.kcGroupId, req.params.userId);

      await logAudit({
        actor: req.jwtPayload!,
        action: "remove_tenant_member",
        entity: "tenant_member",
        entityId: req.params.kcGroupId,
        detail: { userId: req.params.userId },
      });

      res.json({ message: "Usuario removido del tenant." });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
