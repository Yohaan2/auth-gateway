import { Router } from "express";
import { kcAdmin } from "../services/keycloak-admin.service";
import { requireJwt, requireAdminOrViewer, requireAdmin } from "../middleware/jwt-auth";
import { logAudit } from "../audit/audit.service";

const router = Router();

router.use(requireJwt);

// ─── Roles del Realm ──────────────────────────────────────────────────────────

router.get("/", requireAdminOrViewer, async (_req, res, next) => {
  try {
    const roles = await kcAdmin.listRealmRoles();
    res.json(roles);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "El campo 'name' es obligatorio." });

    await kcAdmin.createRealmRole({ name, description });
    await logAudit({ actor: req.jwtPayload!, action: "create_realm_role", entity: "role", entityId: name, detail: { name, description } });
    res.status(201).json({ message: "Rol de realm creado." });
  } catch (err) {
    next(err);
  }
});

router.put("/:roleName", requireAdmin, async (req, res, next) => {
  try {
    const { name, description } = req.body;
    await kcAdmin.updateRealmRole(req.params.roleName, { name, description });
    await logAudit({ actor: req.jwtPayload!, action: "update_realm_role", entity: "role", entityId: req.params.roleName, detail: { name, description } });
    res.json({ message: "Rol de realm actualizado." });
  } catch (err) {
    next(err);
  }
});

router.delete("/:roleName", requireAdmin, async (req, res, next) => {
  try {
    await kcAdmin.deleteRealmRole(req.params.roleName);
    await logAudit({ actor: req.jwtPayload!, action: "delete_realm_role", entity: "role", entityId: req.params.roleName });
    res.json({ message: "Rol de realm eliminado." });
  } catch (err) {
    next(err);
  }
});

router.get("/:roleName/composites", requireAdminOrViewer, async (req, res, next) => {
  try {
    const composites = await kcAdmin.getRealmRoleComposites(req.params.roleName);
    res.json(composites);
  } catch (err) {
    next(err);
  }
});

router.get("/:roleName/users", requireAdminOrViewer, async (req, res, next) => {
  try {
    const users = await kcAdmin.getRealmRoleUsers(req.params.roleName);
    res.json(users);
  } catch (err) {
    next(err);
  }
});

export default router;
