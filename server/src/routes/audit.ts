import { Router } from "express";
import { desc, ilike, or, sql } from "drizzle-orm";
import { db } from "../db/client";
import { auditLogs } from "../db/schema";
import { requireJwt, requireAdminOrViewer } from "../middleware/jwt-auth";

const router = Router();

router.use(requireJwt, requireAdminOrViewer);

router.get("/", async (req, res, next) => {
  try {
    const { search, first = "0", max = "50" } = req.query as Record<string, string>;
    const offset = Math.max(0, parseInt(first, 10) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(max, 10) || 50));

    const term = search?.trim();
    const where = term
      ? or(
          ilike(auditLogs.action, `%${term}%`),
          ilike(auditLogs.entity, `%${term}%`),
          ilike(auditLogs.entityId, `%${term}%`),
          ilike(auditLogs.actorEmail, `%${term}%`),
          ilike(auditLogs.actorSub, `%${term}%`)
        )
      : undefined;

    const [rows, countRow] = await Promise.all([
      db
        .select()
        .from(auditLogs)
        .where(where)
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLogs)
        .where(where),
    ]);

    res.json({ logs: rows, total: countRow[0]?.count ?? 0 });
  } catch (err) {
    next(err);
  }
});

export default router;
