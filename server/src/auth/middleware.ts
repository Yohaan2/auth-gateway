import type { Request, Response, NextFunction } from "express";
import { db } from "../db/client";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

// Extender tipos de express-session e Express Request
declare module "express-session" {
  interface SessionData {
    // Almacena información básica de autenticación tras el flujo OIDC
    tokens?: {
      access_token?: string;
      refresh_token?: string;
      id_token?: string;
      expires_at?: number;
    };
    userInfo?: {
      sub: string;
      email?: string;
      name?: string;
    };
  }
}

declare global {
  namespace Express {
    interface Request {
      // Usuario autenticado obtenido de Postgres y adjuntado al request
      user?: typeof users.$inferSelect;
    }
  }
}

/**
 * Middleware para requerir que el usuario esté autenticado con Keycloak.
 * Verifica si hay tokens guardados en la sesión y si no han expirado.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // TODO: Agregar validación real de expiración del Token usando tokens.expires_at o llamando a Keycloak userInfo.
  // Por ahora, solo se comprueba la existencia de la sesión y los tokens como placeholder de arquitectura.
  if (!req.session || !req.session.tokens || !req.session.userInfo) {
    return res.status(401).json({
      error: "No autorizado",
      message: "Debes iniciar sesión con Keycloak para acceder a este recurso.",
    });
  }

  next();
}

/**
 * Middleware para buscar el usuario en PostgreSQL usando el sub (Keycloak ID) de la sesión.
 * Si no existe, se podría crear de manera perezosa (lazy provisioning) o simplemente dejar un placeholder.
 */
export async function attachUser(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userInfo) {
    return next();
  }

  try {
    const keycloakId = req.session.userInfo.sub;

    // Buscar en la base de datos por ID de Keycloak
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.keycloakId, keycloakId))
      .limit(1);

    if (existingUser) {
      req.user = existingUser;
    } else {
      // TODO: Decidir si crear el usuario automáticamente en la DB al iniciar sesión por primera vez (Provisioning)
      // Ejemplo de lazy provisioning:
      // const [newUser] = await db.insert(users).values({
      //   keycloakId,
      //   email: req.session.userInfo.email || "no-email@keycloak",
      //   name: req.session.userInfo.name || "Usuario Keycloak"
      // }).returning();
      // req.user = newUser;
      
      console.warn(`⚠️ Usuario con Keycloak ID ${keycloakId} autenticado pero no encontrado en PostgreSQL.`);
    }

    next();
  } catch (error) {
    console.error("❌ Error en attachUser middleware:", error);
    next(error); // Pasar al handler de errores centralizado
  }
}
