import { Router } from "express";
import { requireJwt } from "../middleware/jwt-auth";
import { iamRolesService } from "../services/iam-roles.service";

const router = Router();

// Todas las rutas del módulo IAM requieren un JWT válido de Keycloak.
router.use(requireJwt);

/**
 * GET /api/iam/me
 *
 * Devuelve la iinformación básica del usuario autenticado, sus roles
 * administrativos del IAM (obtenidos desde el JWT) y los permisos
 * administrativos disponbles según esos roles. La UI usa esta
 * información para mostrar u ocultar módulos del panel.
 */
router.get("/me", (req, res) => {
  const payload = req.jwtPayload!;
  const { roles, permissions, isSuperAdmin } = iamRolesService.getUserAccess(payload);

  res.json({
    user: {
      id: payload.sub,
      username: payload.preferred_username,
      email: payload.email,
      name: payload.name,
    },
    roles,
    permissions,
    isSuperAdmin,
  });
});

export default router;
