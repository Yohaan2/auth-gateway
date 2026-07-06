/**
 * Rutas de administración del gateway.
 * Solo accesibles para admins del panel (JWT requerido).
 * Permiten registrar/gestionar los módulos externos que usarán el gateway de login.
 */
import { Router } from "express";
import { db } from "../db/client";
import { gatewayClients } from "../db/schema";
import { eq } from "drizzle-orm";
import { requireJwt, requireAdmin } from "../middleware/jwt-auth";
import { logAudit } from "../audit/audit.service";

const router = Router();

router.use(requireJwt, requireAdmin);

// Listar módulos registrados en el gateway
router.get("/", async (_req, res, next) => {
  try {
    const clients = await db
      .select({
        clientId: gatewayClients.clientId,
        name: gatewayClients.name,
        active: gatewayClients.active,
        createdAt: gatewayClients.createdAt,
        updatedAt: gatewayClients.updatedAt,
        // No exponer el secret en el listado
      })
      .from(gatewayClients)
      .orderBy(gatewayClients.createdAt);

    res.json(clients);
  } catch (err) {
    next(err);
  }
});

// Registrar un módulo en el gateway
router.post("/", async (req, res, next) => {
  try {
    const { clientId, clientSecret, name } = req.body;

    if (!clientId?.trim()) return res.status(400).json({ error: "clientId es obligatorio." });
    if (!clientSecret?.trim()) return res.status(400).json({ error: "clientSecret es obligatorio." });

    // Verificar si ya existe
    const [existing] = await db
      .select()
      .from(gatewayClients)
      .where(eq(gatewayClients.clientId, clientId))
      .limit(1);

    if (existing) {
      return res.status(409).json({ error: `El módulo '${clientId}' ya está registrado.` });
    }

    await db.insert(gatewayClients).values({
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      name: name?.trim() || clientId.trim(),
      active: true,
    });

    await logAudit({
      actor: req.jwtPayload!,
      action: "create_client",
      entity: "client",
      entityId: clientId,
      detail: { name, gateway: true },
    });

    res.status(201).json({ message: `Módulo '${clientId}' registrado en el gateway.` });
  } catch (err) {
    next(err);
  }
});

// Actualizar secret o nombre de un módulo
router.put("/:clientId", async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { clientSecret, name, active } = req.body;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (clientSecret?.trim()) updates.clientSecret = clientSecret.trim();
    if (name?.trim()) updates.name = name.trim();
    if (active !== undefined) updates.active = active;

    await db.update(gatewayClients).set(updates).where(eq(gatewayClients.clientId, clientId));

    await logAudit({
      actor: req.jwtPayload!,
      action: "update_client",
      entity: "client",
      entityId: clientId,
      detail: { name, active },
    });

    res.json({ message: "Módulo actualizado." });
  } catch (err) {
    next(err);
  }
});

// Eliminar un módulo del gateway
router.delete("/:clientId", async (req, res, next) => {
  try {
    const { clientId } = req.params;
    await db.delete(gatewayClients).where(eq(gatewayClients.clientId, clientId));

    await logAudit({
      actor: req.jwtPayload!,
      action: "delete_client",
      entity: "client",
      entityId: clientId,
    });

    res.json({ message: `Módulo '${clientId}' eliminado del gateway.` });
  } catch (err) {
    next(err);
  }
});

export default router;
