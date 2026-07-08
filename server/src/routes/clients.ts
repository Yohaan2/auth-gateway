import { Router } from "express";
import { kcAdmin } from "../services/keycloak-admin.service";
import { requireJwt, requireAdminOrViewer, requireAdmin } from "../middleware/jwt-auth";
import { logAudit } from "../audit/audit.service";
import { db } from "../db/client";
import { gatewayClients } from "../db/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.use(requireJwt);

const INTERNAL_CLIENTS = new Set([
  "account", "account-console", "admin-cli", "broker",
  "realm-management", "security-admin-console",
]);

// ─── Módulos (Clients) ────────────────────────────────────────────────────────

router.get("/", requireAdminOrViewer, async (req, res, next) => {
  try {
    const { search, first = "0", max = "50", showInternal } = req.query as Record<string, string>;
    const clients = await kcAdmin.listClients({ search, viewableOnly: true });

    const filtered =
      showInternal === "true"
        ? clients
        : clients.filter((c) => !INTERNAL_CLIENTS.has(c.clientId));

    res.json(filtered);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { clientId, name, description, enabled, publicClient, redirectUris, webOrigins, standardFlowEnabled, serviceAccountsEnabled } = req.body;
    if (!clientId) return res.status(400).json({ error: "El campo 'clientId' es obligatorio." });

    const newId = await kcAdmin.createClient({ clientId, name, description, enabled: enabled ?? true, publicClient: publicClient ?? false, redirectUris, webOrigins, standardFlowEnabled: standardFlowEnabled ?? true, serviceAccountsEnabled: serviceAccountsEnabled ?? false, directAccessGrantsEnabled: true });

    // Los clientes confidenciales se registran automáticamente en el gateway de login,
    // ya que este flujo requiere un client_secret (grant_type=password) para autenticar módulos externos.
    if (!publicClient) {
      try {
        const { value: clientSecret } = await kcAdmin.getClientSecret(newId);
        const [existing] = await db
          .select()
          .from(gatewayClients)
          .where(eq(gatewayClients.clientId, clientId))
          .limit(1);

        if (!existing) {
          await db.insert(gatewayClients).values({
            clientId,
            clientSecret,
            name: name?.trim() || clientId,
            active: enabled ?? true,
          });
        }
      } catch (gwErr) {
        console.error(`⚠️ No se pudo registrar '${clientId}' en el gateway:`, gwErr);
      }
    }

    await logAudit({ actor: req.jwtPayload!, action: "create_client", entity: "client", entityId: newId, detail: { clientId } });
    res.status(201).json({ id: newId, message: "Cliente (módulo) creado." });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAdminOrViewer, async (req, res, next) => {
  try {
    const client = await kcAdmin.getClient(req.params.id);
    res.json(client);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { clientId, name, description, enabled, publicClient, redirectUris, webOrigins } = req.body;

    // Para habilitar/deshabilitar también se puede usar este endpoint
    await kcAdmin.updateClient(req.params.id, { clientId, name, description, enabled, publicClient, redirectUris, webOrigins });

    // Mantener sincronizado el estado del módulo en la tabla del gateway
    if (clientId && (enabled !== undefined || name !== undefined)) {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (enabled !== undefined) updates.active = enabled;
      if (name?.trim()) updates.name = name.trim();
      await db.update(gatewayClients).set(updates).where(eq(gatewayClients.clientId, clientId));
    }

    const action = req.body.enabled !== undefined
      ? (req.body.enabled ? "enable_client" : "disable_client")
      : "update_client";

    await logAudit({ actor: req.jwtPayload!, action, entity: "client", entityId: req.params.id, detail: req.body });
    res.json({ message: "Cliente actualizado." });
  } catch (err) {
    next(err);
  }
});

// ─── Roles del Client ─────────────────────────────────────────────────────────

router.get("/:id/roles", requireAdminOrViewer, async (req, res, next) => {
  try {
    const roles = await kcAdmin.getClientRoles(req.params.id);
    res.json(roles);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/roles", requireAdmin, async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "El campo 'name' es obligatorio." });

    await kcAdmin.createClientRole(req.params.id, { name, description });
    await logAudit({ actor: req.jwtPayload!, action: "create_client_role", entity: "client_role", entityId: `${req.params.id}:${name}`, detail: { name, description } });
    res.status(201).json({ message: "Rol de cliente creado." });
  } catch (err) {
    next(err);
  }
});

router.put("/:id/roles/:roleName", requireAdmin, async (req, res, next) => {
  try {
    const { name, description } = req.body;
    await kcAdmin.updateClientRole(req.params.id, req.params.roleName, { name, description });
    await logAudit({ actor: req.jwtPayload!, action: "update_client_role", entity: "client_role", entityId: `${req.params.id}:${req.params.roleName}` });
    res.json({ message: "Rol de cliente actualizado." });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/roles/:roleName", requireAdmin, async (req, res, next) => {
  try {
    await kcAdmin.deleteClientRole(req.params.id, req.params.roleName);
    await logAudit({ actor: req.jwtPayload!, action: "delete_client_role", entity: "client_role", entityId: `${req.params.id}:${req.params.roleName}` });
    res.json({ message: "Rol de cliente eliminado." });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/roles/:roleName/users", requireAdminOrViewer, async (req, res, next) => {
  try {
    const users = await kcAdmin.getClientRoleUsers(req.params.id, req.params.roleName);
    res.json(users);
  } catch (err) {
    next(err);
  }
});

export default router;
