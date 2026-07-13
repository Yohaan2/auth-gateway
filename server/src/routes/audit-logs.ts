import { Router } from "express";
import { desc, ilike, or, and, gte, lte, sql } from "drizzle-orm";
import { db } from "../db/client";
import { auditLogs } from "../db/schema";
import { requireJwt } from "../middleware/jwt-auth";
import { Permissions } from "../common/decorators/roles.decorator";
import { IAM_PERMISSIONS } from "../config/iam-roles";

const router = Router();

router.use(requireJwt);

/**
 * GET /api/admin/audit-logs
 *
 * Lista los registros de auditoría con paginación y filtros opcionales.
 * Requiere permiso `iam:view_audit` (SUPER_ADMIN, IAM_ADMIN, AUDITOR).
 *
 * Query params:
 *   - first: offset (default 0)
 *   - max: limit (default 50)
 *   - search: busca en actorSub, actorEmail, action, entity, entityId
 *   - action: filtro exacto por acción
 *   - entity: filtro exacto por entidad
 *   - actorSub: filtro exacto por sub del actor
 *   - from: ISO timestamp (inicio del rango)
 *   - to: ISO timestamp (fin del rango)
 */
router.get(
  "/",
  Permissions(IAM_PERMISSIONS.VIEW_AUDIT),
  async (req, res, next) => {
    try {
      const {
        first = "0",
        max = "50",
        search,
        action,
        entity,
        actorSub,
        from,
        to,
      } = req.query as Record<string, string>;

      const offset = Math.max(0, parseInt(first, 10) || 0);
      const limit = Math.min(200, Math.max(1, parseInt(max, 10) || 50));

      const conditions: ReturnType<typeof ilike>[] = [];

      if (search) {
        const pattern = `%${search}%`;
        conditions.push(
          or(
            ilike(auditLogs.actorSub, pattern),
            ilike(auditLogs.actorEmail, pattern),
            ilike(auditLogs.action, pattern),
            ilike(auditLogs.entity, pattern),
            ilike(auditLogs.entityId, pattern)
          ) as any
        );
      }

      if (action) conditions.push(ilike(auditLogs.action, action) as any);
      if (entity) conditions.push(ilike(auditLogs.entity, entity) as any);
      if (actorSub) conditions.push(ilike(auditLogs.actorSub, `%${actorSub}%`) as any);
      if (from) conditions.push(gte(auditLogs.timestamp, new Date(from)) as any);
      if (to) conditions.push(lte(auditLogs.timestamp, new Date(to)) as any);

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, countResult] = await Promise.all([
        db
          .select()
          .from(auditLogs)
          .where(where)
          .orderBy(desc(auditLogs.timestamp))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`cast(count(*) as integer)` })
          .from(auditLogs)
          .where(where),
      ]);

      res.json({
        logs: rows,
        total: countResult[0]?.count ?? 0,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
