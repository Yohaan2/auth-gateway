import type { Request, Response, NextFunction } from "express";
import type { IamRole, IamPermission } from "../../config/iam-roles";
import { iamRolesService } from "../../services/iam-roles.service";

/**
 * Guard de RBAC para el módulo IAM. Debe usarse siempre después de
 * `requireJwt`, ya que depende de `req.jwtPayload`.
 */
export function RolesGuard(...allowedRoles: IamRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.jwtPayload) {
      return res.status(401).json({ error: "No autorizado", message: "Token Bearer requerido." });
    }

    if (allowedRoles.length === 0 || iamRolesService.hasAnyRole(req.jwtPayload, allowedRoles)) {
      return next();
    }

    return res.status(403).json({
      error: "Acceso denegado",
      message: `Se requiere uno de los roles administrativos del IAM: ${allowedRoles.join(", ")}.`,
    });
  };
}

/**
 * Guard de permisos para el módulo IAM. Verifica que el usuario tenga
 * al menos uno de los permisos especificados según su rol administrativo.
 */
export function PermissionsGuard(...allowedPermissions: IamPermission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.jwtPayload) {
      return res.status(401).json({ error: "No autorizado", message: "Token Bearer requerido." });
    }

    const { permissions } = iamRolesService.getUserAccess(req.jwtPayload);
    if (allowedPermissions.length === 0 || allowedPermissions.some((p) => permissions.includes(p))) {
      return next();
    }

    return res.status(403).json({
      error: "Acceso denegado",
      message: `Se requiere uno de los permisos administrativos del IAM: ${allowedPermissions.join(", ")}.`,
    });
  };
}

/**
 * Decorador de roles al estilo `@Roles(...)`. En Express (basado en
 * funciones, no en clases/controladores) se expresa como una factory de
 * middleware que produce el mismo guard de autorización, de modo que se
 * puede anotar cada endpoint administrativo del IAM de forma declarativa:
 *
 * ```ts
 * router.get("/admin/tenants", requireJwt, Roles(IAM_ROLES.TENANT_ADMIN, IAM_ROLES.SUPER_ADMIN), handler);
 * ```
 */
export function Roles(...allowedRoles: IamRole[]) {
  return RolesGuard(...allowedRoles);
}

/**
 * Decorador de permisos al estilo `@Permissions(...)`. Permite proteger
 * endpoints según los permisos administrativos del IAM:
 *
 * ```ts
 * router.post("/users/:id/roles/realm", requireJwt, Permissions(IAM_PERMISSIONS.MANAGE_USERS), handler);
 * ```
 */
export function Permissions(...allowedPermissions: IamPermission[]) {
  return PermissionsGuard(...allowedPermissions);
}
