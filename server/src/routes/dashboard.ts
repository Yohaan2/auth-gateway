import { Router } from "express";
import { kcAdmin } from "../services/keycloak-admin.service";
import { requireJwt, requireAdminOrViewer } from "../middleware/jwt-auth";

const router = Router();

router.use(requireJwt, requireAdminOrViewer);

router.get("/", async (_req, res, next) => {
  try {
    const [userCount, disabledCount, users, clients, realmRoles] = await Promise.all([
      kcAdmin.getUserCount(),
      kcAdmin.getUserCount({ enabled: false }),
      kcAdmin.listUsers({ first: 0, max: 5, search: "" }),
      kcAdmin.listClients({ viewableOnly: true }),
      kcAdmin.listRealmRoles(),
    ]);

    // Excluir clientes internos de Keycloak del conteo
    const internalClients = new Set([
      "account", "account-console", "admin-cli", "broker",
      "realm-management", "security-admin-console",
    ]);
    const modules = clients.filter((c) => !internalClients.has(c.clientId));

    res.json({
      totalUsers: userCount,
      disabledUsers: disabledCount,
      totalModules: modules.length,
      totalRealmRoles: realmRoles.length,
      recentUsers: users,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
