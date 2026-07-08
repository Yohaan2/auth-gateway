import { Router } from "express";
import { z } from "zod";
import { kcAdmin } from "../services/keycloak-admin.service";
import { provisioningService } from "../services/provisioning.service";
import { requireJwt, requireAdminOrViewer, requireAdmin } from "../middleware/jwt-auth";
import { logAudit } from "../audit/audit.service";
import { Permissions } from "../common/decorators/roles.decorator";
import { IAM_PERMISSIONS } from "../config/iam-roles";
import { sensitiveLimiter } from "../middleware/rate-limiter";

const router = Router();

router.use(requireJwt);

// ─── Esquemas de validación ───────────────────────────────────────────────────

const createProvisionedUserSchema = z.object({
  username: z.string().min(1, "El campo 'username' es obligatorio."),
  email: z.string().email("Email inválido.").optional().or(z.literal("")),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  /** ID del grupo Keycloak (tenant) al que asignar el usuario al crearlo. */
  tenantId: z.string().optional(),
  /** UUID de la plantilla de acceso a aplicar. */
  templateId: z.string().uuid("templateId debe ser un UUID válido.").optional(),
  enabled: z.boolean().optional().default(true),
  /** Si true, Keycloak enviará un email de activación al usuario. */
  sendActivationEmail: z.boolean().optional().default(false),
  /** Contraseña inicial opcional */
  password: z.string().optional(),
  /** Contraseña temporal */
  temporaryPassword: z.boolean().optional().default(false),
});

// ─── Listado y búsqueda ───────────────────────────────────────────────────────

router.get("/", requireAdminOrViewer, async (req, res, next) => {
  try {
    const { search, email, username, first = "0", max = "20", enabled, emailVerified } = req.query as Record<string, string>;

    const params: Record<string, any> = {
      first: parseInt(first, 10),
      max: parseInt(max, 10),
    };
    if (search) params.search = search;
    if (email) params.email = email;
    if (username) params.username = username;
    if (enabled !== undefined) params.enabled = enabled === "true";
    if (emailVerified !== undefined) params.emailVerified = emailVerified === "true";

    const [users, total] = await Promise.all([
      kcAdmin.listUsers(params),
      kcAdmin.getUserCount(params),
    ]);

    res.json({ users, total });
  } catch (err) {
    next(err);
  }
});

// ─── Crear usuario con aprovisionamiento completo (Fase 4) ────────────────────

router.post("/", requireAdmin, sensitiveLimiter, async (req, res, next) => {
  try {
    const parsed = createProvisionedUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos.", details: parsed.error.flatten() });
    }

    const result = await provisioningService.createAndProvisionUser(
      {
        ...parsed.data,
        email: parsed.data.email?.trim() || undefined,
      },
      req.jwtPayload!
    );

    res.status(201).json({
      id: result.keycloakId,
      iamUserId: result.iamUserId,
      message: result.templateApplied
        ? "Usuario creado y aprovisionado con la plantilla de acceso."
        : "Usuario creado exitosamente.",
      templateApplied: result.templateApplied,
      activationEmailSent: result.activationEmailSent,
    });
  } catch (err: any) {
    // El servicio ya hizo rollback en Keycloak si fue necesario
    next(err);
  }
});

// ─── Detalle de usuario ───────────────────────────────────────────────────────

router.get("/:id", requireAdminOrViewer, async (req, res, next) => {
  try {
    const user = await kcAdmin.getUser(req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// ─── Perfil IAM del usuario (DB local) ───────────────────────────────────────

router.get("/:id/iam-profile", requireAdminOrViewer, async (req, res, next) => {
  try {
    const profile = await provisioningService.getIamProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: "Perfil IAM no encontrado para este usuario." });
    }
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

// ─── Actualizar usuario ───────────────────────────────────────────────────────

router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { username, email, firstName, lastName, enabled, emailVerified, requiredActions } = req.body;
    await kcAdmin.updateUser(req.params.id, { username, email, firstName, lastName, enabled, emailVerified, requiredActions });

    await logAudit({
      actor: req.jwtPayload!,
      action: "update_user",
      entity: "user",
      entityId: req.params.id,
      detail: req.body,
    });

    res.json({ message: "Usuario actualizado." });
  } catch (err) {
    next(err);
  }
});

// ─── Eliminar usuario ─────────────────────────────────────────────────────────

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    await kcAdmin.deleteUser(req.params.id);
    await logAudit({ actor: req.jwtPayload!, action: "delete_user", entity: "user", entityId: req.params.id });
    res.json({ message: "Usuario eliminado." });
  } catch (err) {
    next(err);
  }
});

// ─── Reset de contraseña ──────────────────────────────────────────────────────

router.put("/:id/reset-password", requireAdmin, sensitiveLimiter, async (req, res, next) => {
  try {
    const { password, temporary = true } = req.body;
    if (!password) return res.status(400).json({ error: "El campo 'password' es obligatorio." });

    await kcAdmin.resetPassword(req.params.id, password, temporary);
    await logAudit({ actor: req.jwtPayload!, action: "reset_password", entity: "user", entityId: req.params.id });
    res.json({ message: "Contraseña restablecida." });
  } catch (err) {
    next(err);
  }
});

// ─── Verificar email manualmente ──────────────────────────────────────────────

router.post("/:id/verify-email", requireAdmin, async (req, res, next) => {
  try {
    await kcAdmin.sendVerificationEmail(req.params.id);
    await logAudit({ actor: req.jwtPayload!, action: "verify_email", entity: "user", entityId: req.params.id });
    res.json({ message: "Email de verificación enviado." });
  } catch (err) {
    next(err);
  }
});

// ─── Sesiones activas ─────────────────────────────────────────────────────────

router.get("/:id/sessions", requireAdminOrViewer, async (req, res, next) => {
  try {
    const sessions = await kcAdmin.getUserSessions(req.params.id);
    res.json(sessions);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/sessions", requireAdmin, async (req, res, next) => {
  try {
    await kcAdmin.deleteUserSessions(req.params.id);
    await logAudit({ actor: req.jwtPayload!, action: "revoke_sessions", entity: "session", entityId: req.params.id });
    res.json({ message: "Sesiones revocadas." });
  } catch (err) {
    next(err);
  }
});

// ─── Asignación de roles ──────────────────────────────────────────────────────

router.get("/:id/roles", Permissions(IAM_PERMISSIONS.MANAGE_USERS), async (req, res, next) => {
  try {
    const mappings = await kcAdmin.getUserRoleMappings(req.params.id);
    res.json(mappings);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/roles/realm", Permissions(IAM_PERMISSIONS.MANAGE_USERS), async (req, res, next) => {
  try {
    const { roles } = req.body;
    if (!Array.isArray(roles)) return res.status(400).json({ error: "'roles' debe ser un array." });
    await kcAdmin.addRealmRolesToUser(req.params.id, roles);
    await logAudit({ actor: req.jwtPayload!, action: "assign_realm_role", entity: "user", entityId: req.params.id, detail: { roles } });
    res.json({ message: "Roles de realm asignados." });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/roles/realm", Permissions(IAM_PERMISSIONS.MANAGE_USERS), async (req, res, next) => {
  try {
    const { roles } = req.body;
    if (!Array.isArray(roles)) return res.status(400).json({ error: "'roles' debe ser un array." });
    await kcAdmin.removeRealmRolesFromUser(req.params.id, roles);
    await logAudit({ actor: req.jwtPayload!, action: "remove_realm_role", entity: "user", entityId: req.params.id, detail: { roles } });
    res.json({ message: "Roles de realm removidos." });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/roles/clients/:clientUuid", requireAdmin, async (req, res, next) => {
  try {
    const { roles } = req.body;
    if (!Array.isArray(roles)) return res.status(400).json({ error: "'roles' debe ser un array." });
    await kcAdmin.addClientRolesToUser(req.params.id, req.params.clientUuid, roles);
    await logAudit({ actor: req.jwtPayload!, action: "assign_client_role", entity: "user", entityId: req.params.id, detail: { clientUuid: req.params.clientUuid, roles } });
    res.json({ message: "Roles de cliente asignados." });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/roles/clients/:clientUuid", requireAdmin, async (req, res, next) => {
  try {
    const { roles } = req.body;
    if (!Array.isArray(roles)) return res.status(400).json({ error: "'roles' debe ser un array." });
    await kcAdmin.removeClientRolesFromUser(req.params.id, req.params.clientUuid, roles);
    await logAudit({ actor: req.jwtPayload!, action: "remove_client_role", entity: "user", entityId: req.params.id, detail: { clientUuid: req.params.clientUuid, roles } });
    res.json({ message: "Roles de cliente removidos." });
  } catch (err) {
    next(err);
  }
});

// ─── Grupos del usuario ───────────────────────────────────────────────────────

router.get("/:id/groups", requireAdminOrViewer, async (req, res, next) => {
  try {
    const groups = await kcAdmin.getUserGroups(req.params.id);
    res.json(groups);
  } catch (err) {
    next(err);
  }
});

// ─── Gestión de plantilla (Fase 4) ───────────────────────────────────────────

/**
 * PUT /api/admin/users/:id/template
 * Cambia la plantilla de acceso asignada a un usuario.
 * Desasigna la plantilla anterior y aplica la nueva en Keycloak.
 */
router.put("/:id/template", Permissions(IAM_PERMISSIONS.MANAGE_USERS), async (req, res, next) => {
  try {
    const { templateId } = req.body;
    if (!templateId || typeof templateId !== "string") {
      return res.status(400).json({ error: "El campo 'templateId' es obligatorio." });
    }

    await provisioningService.changeTemplate(req.params.id, templateId, req.jwtPayload!);
    res.json({ message: "Plantilla de acceso actualizada." });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/users/:id/reapply-template
 * Reaaplica la plantilla actual al usuario (idempotente).
 */
router.post("/:id/reapply-template", Permissions(IAM_PERMISSIONS.MANAGE_USERS), async (req, res, next) => {
  try {
    await provisioningService.reapplyTemplate(req.params.id, req.jwtPayload!);
    res.json({ message: "Plantilla reaplicada exitosamente." });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/users/:id/sync
 * Sincroniza el estado del usuario entre Keycloak y la DB del IAM.
 */
router.post("/:id/sync", Permissions(IAM_PERMISSIONS.MANAGE_USERS), async (req, res, next) => {
  try {
    await provisioningService.syncUser(req.params.id, req.jwtPayload!);
    res.json({ message: "Usuario sincronizado exitosamente." });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/users/:id/activation-email
 * Envía un email de activación al usuario.
 */
router.post("/:id/activation-email", requireAdmin, sensitiveLimiter, async (req, res, next) => {
  try {
    await kcAdmin.sendActivationEmail(req.params.id);
    await logAudit({
      actor: req.jwtPayload!,
      action: "send_activation_email",
      entity: "iam_user",
      entityId: req.params.id,
    });
    res.json({ message: "Email de activación enviado." });
  } catch (err) {
    next(err);
  }
});

export default router;
