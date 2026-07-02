import { Router } from "express";
import { getKeycloakClient } from "./keycloak";
import { requireAuth, attachUser } from "./middleware";
import { db } from "../db/client";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { env } from "../config/env";

const router = Router();

/**
 * @route GET /api/auth/login
 * @desc Redirige al usuario al servidor de Keycloak para iniciar sesión
 */
router.get("/login", async (req, res, next) => {
  try {
    const client = await getKeycloakClient();
    
    // Generar state y nonce para proteger contra ataques CSRF y Replay
    const state = Math.random().toString(36).substring(2, 15);
    const nonce = Math.random().toString(36).substring(2, 15);
    
    // Guardar en la sesión temporal para validación posterior en el callback
    if (req.session) {
      (req.session as any).oidcState = state;
      (req.session as any).oidcNonce = nonce;
    }
    
    const authorizationUrl = client.authorizationUrl({
      scope: "openid email profile",
      state,
      nonce,
    });
    
    res.redirect(authorizationUrl);
  } catch (error) {
    console.error("❌ Error al generar URL de login:", error);
    next(error);
  }
});

/**
 * @route GET /api/auth/callback
 * @desc Callback que recibe el code de Keycloak y realiza el intercambio por tokens
 */
router.get("/callback", async (req, res, next) => {
  try {
    const client = await getKeycloakClient();
    const params = client.callbackParams(req);
    
    const state = (req.session as any)?.oidcState;
    const nonce = (req.session as any)?.oidcNonce;
    
    // Limpiar state y nonce de la sesión inmediatamente después de leerlos
    if (req.session) {
      delete (req.session as any).oidcState;
      delete (req.session as any).oidcNonce;
    }
    
    console.log("📥 Recibido callback de Keycloak, procesando intercambio...");
    
    const tokenSet = await client.callback(
      env.KEYCLOAK_REDIRECT_URI,
      params,
      { state, nonce }
    );
    
    // Obtener información del usuario a través del Token o del Endpoint UserInfo
    const userInfo = await client.userinfo(tokenSet);
    
    // Guardar tokens y usuario en la sesión de Express
    req.session.tokens = {
      access_token: tokenSet.access_token,
      refresh_token: tokenSet.refresh_token,
      id_token: tokenSet.id_token,
      expires_at: tokenSet.expires_at,
    };
    
    req.session.userInfo = {
      sub: userInfo.sub,
      email: userInfo.email,
      name: (userInfo as any).name || (userInfo as any).preferred_username,
    };
    
    // Sincronizar el usuario con la base de datos de Postgres (Lazy Provisioning)
    const keycloakId = userInfo.sub;
    const email = userInfo.email || `${keycloakId}@no-email.keycloak`;
    const name = (userInfo as any).name || (userInfo as any).preferred_username || "Usuario";
    
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.keycloakId, keycloakId))
      .limit(1);
      
    if (!existingUser) {
      console.log(`👤 Registrando nuevo usuario en PostgreSQL desde Keycloak: ${email}`);
      await db.insert(users).values({
        keycloakId,
        email,
        name,
      });
    } else {
      // Actualizar información del usuario si ha cambiado
      await db
        .update(users)
        .set({ name, updatedAt: new Date() })
        .where(eq(users.keycloakId, keycloakId));
    }
    
    // Redirigir a la página principal del frontend
    res.redirect("/");
  } catch (error) {
    console.error("❌ Error en el callback de autenticación:", error);
    // Redirigir al home con un query param de error para el frontend
    res.redirect("/?auth_error=callback_failed");
  }
});

/**
 * @route GET /api/auth/logout
 * @desc Destruye la sesión de Express y redirige a la URL de logout de Keycloak
 */
router.get("/logout", async (req, res, next) => {
  try {
    const client = await getKeycloakClient();
    const idToken = req.session?.tokens?.id_token;
    
    req.session.destroy((err) => {
      if (err) {
        console.error("❌ Error al destruir sesión local:", err);
      }
      
      // Obtener URL de logout de Keycloak
      // Muchos servidores OIDC/Keycloak requieren el id_token_hint para un logout seguro
      const logoutUrl = client.endSessionUrl({
        id_token_hint: idToken,
        post_logout_redirect_uri: env.KEYCLOAK_POST_LOGOUT_REDIRECT_URI || env.APP_URL,
      });
      
      res.redirect(logoutUrl);
    });
  } catch (error) {
    console.error("❌ Error en logout:", error);
    next(error);
  }
});

/**
 * @route GET /api/auth/me
 * @desc Devuelve el perfil del usuario autenticado guardado en PostgreSQL
 * Requiere que pase por attachUser previamente para cargar req.user
 */
router.get("/me", requireAuth, attachUser, (req, res) => {
  // En este punto, requireAuth validó que haya sesión
  // y attachUser cargó req.user de la base de datos si existe.
  if (!req.user) {
    return res.status(200).json({
      authenticated: true,
      userInfo: req.session.userInfo,
      message: "Autenticado en Keycloak pero no sincronizado con base de datos."
    });
  }

  res.status(200).json({
    authenticated: true,
    user: req.user,
  });
});

export default router;
