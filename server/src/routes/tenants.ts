import { Router } from "express";
import { requireJwt } from "../middleware/jwt-auth";
import { Permissions } from "../common/decorators/roles.decorator";
import { IAM_PERMISSIONS } from "../config/iam-roles";
import { tenantService, toSlug } from "../services/tenant.service";
import { logAudit } from "../audit/audit.service";
import { sensitiveLimiter } from "../middleware/rate-limiter";

const router = Router();
router.use(requireJwt);

// ─── Listar tenants (paginado) ────────────────────────────────────────────────

router.get("/", Permissions(IAM_PERMISSIONS.MANAGE_TENANTS), async (req, res, next) => {
  try {
    const first = parseInt((req.query.first as string) ?? "0", 10) || 0;
    const max = parseInt((req.query.max as string) ?? "15", 10) || 15;

    const result = await tenantService.listTenants({ first, max });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── Crear tenant ─────────────────────────────────────────────────────────────

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
        entityId: tenant.id,
        detail: { name: tenant.name, slug: tenant.slug },
      });

      res.status(201).json({ tenant, message: "Tenant creado exitosamente." });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Detalle de tenant ────────────────────────────────────────────────────────

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
 * GET /api/admin/tenants/:kcGroupId/members?first=0&max=5
 * Devuelve miembros directos del grupo tenant de forma paginada.
 */
router.get(
  "/:kcGroupId/members",
  Permissions(IAM_PERMISSIONS.MANAGE_TENANTS),
  async (req, res, next) => {
    try {
      const first = parseInt((req.query.first as string) ?? "0", 10) || 0;
      const max = parseInt((req.query.max as string) ?? "5", 10) || 5;

      const result = await tenantService.getTenantMembers(req.params.kcGroupId, { first, max });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/admin/tenants/:kcGroupId/members
 * Body: { userId }
 * Agrega un usuario al tenant directamente (sin rol).
 */
router.post(
  "/:kcGroupId/members",
  Permissions(IAM_PERMISSIONS.MANAGE_TENANTS),
  async (req, res, next) => {
    try {
      const { userId } = req.body as { userId?: string };

      if (!userId) {
        return res.status(400).json({ error: "El campo 'userId' es obligatorio." });
      }

      await tenantService.addUserToTenant(req.params.kcGroupId, userId);

      await logAudit({
        actor: req.jwtPayload!,
        action: "add_tenant_member",
        entity: "tenant_member",
        entityId: req.params.kcGroupId,
        detail: { userId },
      });

      res.status(201).json({ message: "Usuario agregado al tenant." });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/admin/tenants/:kcGroupId/members/:userId/move
 * Body: { targetTenantId }
 * Mueve al usuario a otro tenant (lo saca del actual y lo mete en el destino).
 */
router.put(
  "/:kcGroupId/members/:userId/move",
  Permissions(IAM_PERMISSIONS.MANAGE_TENANTS),
  async (req, res, next) => {
    try {
      const { targetTenantId } = req.body as { targetTenantId?: string };

      if (!targetTenantId) {
        return res.status(400).json({ error: "El campo 'targetTenantId' es obligatorio." });
      }
      if (targetTenantId === req.params.kcGroupId) {
        return res.status(400).json({ error: "El usuario ya pertenece a ese tenant." });
      }

      await tenantService.moveUserToTenant(req.params.userId, targetTenantId);

      await logAudit({
        actor: req.jwtPayload!,
        action: "update_tenant_member_role",
        entity: "tenant_member",
        entityId: targetTenantId,
        detail: { userId: req.params.userId, fromTenant: req.params.kcGroupId },
      });

      res.json({ message: "Usuario movido al nuevo tenant." });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/admin/tenants/:kcGroupId/members/:userId
 * Saca al usuario del tenant.
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
