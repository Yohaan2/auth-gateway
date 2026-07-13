import { Router } from "express";
import { z } from "zod";
import { requireJwt } from "../middleware/jwt-auth";
import { Permissions } from "../common/decorators/roles.decorator";
import { IAM_PERMISSIONS } from "../config/iam-roles";
import { templatesService } from "../services/templates.service";
import { kcAdmin } from "../services/keycloak-admin.service";
import { logAudit } from "../audit/audit.service";

const router = Router();

router.use(requireJwt);
router.use(Permissions(IAM_PERMISSIONS.MANAGE_TEMPLATES));

// ─── Esquemas de validación ───────────────────────────────────────────────────

const roleSchema = z.object({
  roleName: z.string().min(1),
  roleId: z.string().nullish(),
  isClientRole: z.boolean().nullish(),
  clientId: z.string().nullish(),
});

const groupSchema = z.object({
  groupId: z.string().min(1),
  groupPath: z.string().min(1),
});

const claimSchema = z.object({
  claimKey: z.string().min(1),
  claimValue: z.string(),
});

const permissionSchema = z.object({
  resource: z.string().min(1),
  action: z.string().min(1),
  effect: z.enum(["allow", "deny"]).optional(),
  description: z.string().optional(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio."),
  description: z.string().optional(),
  active: z.boolean().optional(),
  roles: z.array(roleSchema).optional(),
  groups: z.array(groupSchema).optional(),
  claims: z.array(claimSchema).optional(),
  permissions: z.array(permissionSchema).optional(),
});

const updateTemplateSchema = createTemplateSchema.partial();

// ─── Datos auxiliares de Keycloak (para selección en la UI) ─────────────────
// Solo lectura: se consultan roles y grupos disponibles en Keycloak para
// que puedan seleccionarse al armar una plantilla. No se modifica nada.

router.get("/keycloak/roles", async (_req, res, next) => {
  try {
    const roles = await kcAdmin.listRealmRoles();
    res.json(roles);
  } catch (err) {
    next(err);
  }
});

router.get("/keycloak/groups", async (_req, res, next) => {
  try {
    const groups = await kcAdmin.listGroups();
    res.json(groups);
  } catch (err) {
    next(err);
  }
});

// ─── CRUD de plantillas ───────────────────────────────────────────────────────

router.get("/", async (_req, res, next) => {
  try {
    const templates = await templatesService.list();
    res.json(templates);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const template = await templatesService.getById(req.params.id);
    if (!template) return res.status(404).json({ error: "Plantilla no encontrada." });
    res.json(template);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = createTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos.", details: parsed.error.flatten() });
    }

    const template = await templatesService.create(parsed.data);

    await logAudit({
      actor: req.jwtPayload!,
      action: "create_template",
      entity: "template",
      entityId: template.id,
      detail: { name: template.name },
    });

    res.status(201).json(template);
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(409).json({ error: "Ya existe una plantilla con ese nombre." });
    }
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const parsed = updateTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos.", details: parsed.error.flatten() });
    }

    const template = await templatesService.update(req.params.id, parsed.data);
    if (!template) return res.status(404).json({ error: "Plantilla no encontrada." });

    await logAudit({
      actor: req.jwtPayload!,
      action: "update_template",
      entity: "template",
      entityId: req.params.id,
      detail: parsed.data,
    });

    res.json(template);
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(409).json({ error: "Ya existe una plantilla con ese nombre." });
    }
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await templatesService.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Plantilla no encontrada." });

    await logAudit({
      actor: req.jwtPayload!,
      action: "delete_template",
      entity: "template",
      entityId: req.params.id,
      detail: { name: deleted.name },
    });

    res.json({ message: "Plantilla eliminada." });
  } catch (err) {
    next(err);
  }
});

export default router;
