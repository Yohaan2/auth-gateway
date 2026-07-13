import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { parseTenantFromGroups } from "../services/tenant.service";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface KeycloakTokenPayload extends JWTPayload {
  sub: string;
  preferred_username?: string;
  email?: string;
  name?: string;
  realm_access?: { roles: string[] };
  resource_access?: Record<string, { roles: string[] }>;
  azp?: string;
  /**
   * Rutas completas de los grupos a los que pertenece el usuario.
   * Ejemplo: ["/Tenant A/Operadores"]
   * Requiere el mapper "groups" (oidc-group-membership-mapper) en el cliente Keycloak.
   */
  groups?: string[];
}

declare global {
  namespace Express {
    interface Request {
      jwtPayload?: KeycloakTokenPayload;
    }
  }
}

// ─── JWKS remoto (se cachea automáticamente por jose) ─────────────────────────

const getJWKS = (() => {
  let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
  return () => {
    if (!jwks) {
      const internalBase = env.KEYCLOAK_INTERNAL_URL || env.KEYCLOAK_URL;
      jwks = createRemoteJWKSet(
        new URL(`${internalBase}/realms/${env.KEYCLOAK_REALM}/protocol/openid-connect/certs`)
      );
    }
    return jwks;
  };
})();

// ─── Middleware principal ────────────────────────────────────────────────────

export async function requireJwt(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autorizado", message: "Token Bearer requerido." });
  }

  const token = authHeader.slice(7);

  try {
    const issuer = `${env.KEYCLOAK_URL}/realms/${env.KEYCLOAK_REALM}`;
    const { payload } = await jwtVerify<KeycloakTokenPayload>(token, getJWKS(), { issuer });
    req.jwtPayload = payload;
    next();
  } catch (err: any) {
    const msg = err?.code === "ERR_JWT_EXPIRED" ? "Token expirado." : "Token inválido.";
    return res.status(401).json({ error: "No autorizado", message: msg });
  }
}

// ─── Guard de roles ──────────────────────────────────────────────────────────

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const realmRoles = req.jwtPayload?.realm_access?.roles ?? [];
    if (roles.some((r) => realmRoles.includes(r))) {
      return next();
    }
    return res.status(403).json({
      error: "Acceso denegado",
      message: `Se requiere uno de los roles: ${roles.join(", ")}.`,
    });
  };
}

// Helpers de roles del panel
export const requireAdmin = requireRole(env.KEYCLOAK_ADMIN_ROLE);
export const requireAdminOrViewer = requireRole(env.KEYCLOAK_ADMIN_ROLE, env.KEYCLOAK_VIEWER_ROLE);

// ─── Guard de tenant ─────────────────────────────────────────────────────────

/**
 * Verifica que el usuario pertenezca a algún tenant.
 * No requiere un rol específico — solo membresía directa en el grupo.
 */
export function requireTenantAccess() {
  return (req: Request, res: Response, next: NextFunction) => {
    const groups = req.jwtPayload?.groups ?? [];
    const context = parseTenantFromGroups(groups);

    if (!context) {
      return res.status(403).json({
        error: "Acceso denegado",
        message: "El usuario no pertenece a ningún tenant.",
      });
    }

    next();
  };
}

/**
 * Inyecta en `req` el contexto de tenant del usuario extraído de los grupos del JWT.
 * No bloquea si el usuario no tiene tenant asignado.
 */
export function injectTenantContext(req: Request, _res: Response, next: NextFunction) {
  const groups = req.jwtPayload?.groups ?? [];
  (req as any).tenantContext = parseTenantFromGroups(groups);
  next();
}
