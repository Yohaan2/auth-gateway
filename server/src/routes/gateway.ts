/**
 * Gateway público de autenticación.
 * Los módulos externos llaman estos endpoints para hacer login sin conocer
 * el secret de Keycloak — el Auth Manager actúa como intermediario.
 *
 * Endpoints:
 *   POST /api/gateway/login     — login con usuario y contraseña
 *   POST /api/gateway/refresh   — renovar access_token con refresh_token
 *   POST /api/gateway/logout    — cerrar sesión
 *   GET  /api/gateway/verify    — verificar token y obtener info del usuario
 */
import { Router } from "express";
import axios from "axios";
import { db } from "../db/client";
import { gatewayClients, iamUsers, auditLogs } from "../db/schema";
import { eq } from "drizzle-orm";
import { env } from "../config/env";
import { sensitiveLimiter } from "../middleware/rate-limiter";
import { createRemoteJWKSet, jwtVerify } from "jose";

const router = Router();

// JWKS compartido para verificar tokens en /verify
const getJWKS = (() => {
  let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
  return () => {
    if (!jwks) {
      const base = env.KEYCLOAK_INTERNAL_URL || env.KEYCLOAK_URL;
      jwks = createRemoteJWKSet(
        new URL(`${base}/realms/${env.KEYCLOAK_REALM}/protocol/openid-connect/certs`)
      );
    }
    return jwks;
  };
})();

// Obtiene el cliente del gateway de la DB y valida que esté activo
async function getGatewayClient(clientId: string) {
  const [client] = await db
    .select()
    .from(gatewayClients)
    .where(eq(gatewayClients.clientId, clientId))
    .limit(1);
  return client;
}

// Decodifica el payload de un JWT sin verificar firma (solo para leer claims)
function decodePayload(token: string): Record<string, unknown> {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
  } catch {
    return {};
  }
}

const ignoredRoles = [
  "default-roles-optrax-realm",
  "offline_access",
  "uma_authorization",
];

// ─── POST /api/gateway/login ─────────────────────────────────────────────────

router.post("/login", sensitiveLimiter, async (req, res, next) => {
  try {
    const { username, password, clientId } = req.body;

    if (!username || !password || !clientId) {
      return res.status(400).json({
        error: "Los campos 'username', 'password' y 'clientId' son obligatorios.",
      });
    }

    // Buscar el cliente en la DB del gateway
    const gwClient = await getGatewayClient(clientId);
    if (!gwClient) {
      return res.status(404).json({
        error: `El módulo '${clientId}' no está registrado en el gateway.`,
      });
    }
    if (!gwClient.active) {
      return res.status(403).json({
        error: `El módulo '${clientId}' está deshabilitado.`,
      });
    }

    // Llamar a Keycloak con Resource Owner Password Credentials
    const kcBase = env.KEYCLOAK_INTERNAL_URL || env.KEYCLOAK_URL;
    const params = new URLSearchParams({
      grant_type: "password",
      client_id: gwClient.clientId,
      client_secret: gwClient.clientSecret,
      username,
      password,
      scope: "openid profile email optrax-iam",
    });

    let kcResponse: any;
    try {
      const { data } = await axios.post(
        `${kcBase}/realms/${env.KEYCLOAK_REALM}/protocol/openid-connect/token`,
        params.toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Forwarded-Proto": "https",
            "X-Forwarded-Host": new URL(env.KEYCLOAK_URL).host,
          },
        }
      );
      kcResponse = data;
    } catch (err: any) {
      const status = err.response?.status;
      const kcError = err.response?.data?.error;

      if (status === 401 || (status === 400 && kcError === "invalid_grant")) {
        return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
      }
      if (status === 400 && kcError === "invalid_client") {
        return res.status(502).json({
          error: "Configuración del módulo inválida. Verifique el clientSecret registrado.",
        });
      }
      throw err;
    }

    // Extraer info del token
    const payload = decodePayload(kcResponse.access_token);
    const resourceAccess = (payload.resource_access as Record<string, { roles: string[] }>) ?? {};
    const clientRoles: string[] = resourceAccess[clientId]?.roles ?? [];
    const realmRoles: string[] = (payload.realm_access as any)?.roles ?? [];
    const groups: string[] = (payload.groups as string[]) ?? [];

    const businessRoles = realmRoles.filter((role) => !ignoredRoles.includes(role));

    // Obtener tenant de la base de datos iam_users
    const [iamUser] = await db
      .select()
      .from(iamUsers)
      .where(eq(iamUsers.keycloakId, payload.sub as string))
      .limit(1);

    const tenant = iamUser?.tenant ?? null;

    res.json({
      access_token: kcResponse.access_token,
      refresh_token: kcResponse.refresh_token,
      expires_in: kcResponse.expires_in,
      token_type: "Bearer",
      user: {
        id: payload.sub,
        username: payload.preferred_username,
        email: payload.email,
        name: payload.name,
        roles: clientRoles,  // roles del módulo que hizo login
        realmRoles: businessRoles,
        groups,
        tenant,
      },
    });

    // Registrar actividad de login en auditoría (no bloquea la respuesta)
    db.insert(auditLogs).values({
      actorSub: username,
      actorEmail: (payload.email as string) ?? null,
      action: "gateway_login",
      entity: "gateway_session",
      entityId: clientId,
      detail: {
        clientId,
        clientName: gwClient.name ?? clientId,
        username: payload.preferred_username,
        roles: clientRoles,
        realmRoles: businessRoles,
        tenant,
        ip: req.ip ?? req.socket?.remoteAddress ?? null,
      },
    }).catch((err) => console.error("⚠️  Error al registrar gateway_login en auditoría:", err));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/gateway/refresh ───────────────────────────────────────────────

router.post("/refresh", async (req, res, next) => {
  try {
    const { refresh_token, clientId } = req.body;

    if (!refresh_token || !clientId) {
      return res.status(400).json({
        error: "Los campos 'refresh_token' y 'clientId' son obligatorios.",
      });
    }

    const gwClient = await getGatewayClient(clientId);
    if (!gwClient || !gwClient.active) {
      return res.status(403).json({ error: "Módulo no registrado o deshabilitado." });
    }

    const kcBase = env.KEYCLOAK_INTERNAL_URL || env.KEYCLOAK_URL;
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: gwClient.clientId,
      client_secret: gwClient.clientSecret,
      refresh_token,
      scope: "openid profile email optrax-iam",
    });

    try {
      const { data } = await axios.post(
        `${kcBase}/realms/${env.KEYCLOAK_REALM}/protocol/openid-connect/token`,
        params.toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      const payload = decodePayload(data.access_token);
      const resourceAccess = (payload.resource_access as Record<string, { roles: string[] }>) ?? {};
      const clientRoles: string[] = resourceAccess[clientId]?.roles ?? [];
      const realmRoles: string[] = (payload.realm_access as any)?.roles ?? [];
      const groups: string[] = (payload.groups as string[]) ?? [];

      const internalClients = new Set(["account", "account-console", "broker", "realm-management", "security-admin-console"]);
      const modules: Record<string, string[]> = {};
      for (const [cid, val] of Object.entries(resourceAccess)) {
        if (!internalClients.has(cid) && val.roles?.length) {
          modules[cid] = val.roles;
        }
      }

      // Obtener tenant de la base de datos iam_users
      const [iamUser] = await db
        .select()
        .from(iamUsers)
        .where(eq(iamUsers.keycloakId, payload.sub as string))
        .limit(1);

      const tenant = iamUser?.tenant ?? null;

      res.json({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        token_type: "Bearer",
        user: {
          sub: payload.sub,
          username: payload.preferred_username,
          email: payload.email,
          roles: clientRoles,
          realmRoles,
          groups,
          tenant,
          modules,
        },
      });
    } catch (err: any) {
      if (err.response?.status === 400) {
        return res.status(401).json({ error: "Sesión expirada. Inicia sesión de nuevo." });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/gateway/logout ────────────────────────────────────────────────

router.post("/logout", async (req, res, next) => {
  try {
    const { refresh_token, clientId } = req.body;

    if (!refresh_token || !clientId) {
      return res.status(400).json({
        error: "Los campos 'refresh_token' y 'clientId' son obligatorios.",
      });
    }

    const gwClient = await getGatewayClient(clientId);
    if (gwClient) {
      const kcBase = env.KEYCLOAK_INTERNAL_URL || env.KEYCLOAK_URL;
      const params = new URLSearchParams({
        client_id: gwClient.clientId,
        client_secret: gwClient.clientSecret,
        refresh_token,
      });

      await axios
        .post(
          `${kcBase}/realms/${env.KEYCLOAK_REALM}/protocol/openid-connect/logout`,
          params.toString(),
          { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        )
        .catch(() => {
          // Ignorar errores del logout — igual responder OK
        });
    }

    res.json({ message: "Sesión cerrada correctamente." });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/gateway/verify ─────────────────────────────────────────────────

router.get("/verify", async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token Bearer requerido." });
    }

    const token = authHeader.slice(7);
    const { clientId } = req.query as { clientId?: string };

    try {
      const issuer = `${env.KEYCLOAK_URL}/realms/${env.KEYCLOAK_REALM}`;
      const { payload } = await jwtVerify(token, getJWKS(), { issuer });

      const resourceAccess = ((payload as any).resource_access as Record<string, { roles: string[] }>) ?? {};
      const clientRoles: string[] = clientId ? resourceAccess[clientId]?.roles ?? [] : [];
      const realmRoles: string[] = (payload.realm_access as any)?.roles ?? [];
      const groups: string[] = ((payload as any).groups as string[]) ?? [];

      const internalClients = new Set(["account", "account-console", "broker", "realm-management", "security-admin-console"]);
      const modules: Record<string, string[]> = {};
      for (const [cid, val] of Object.entries(resourceAccess)) {
        if (!internalClients.has(cid) && val.roles?.length) {
          modules[cid] = val.roles;
        }
      }

      // Obtener tenant de la base de datos iam_users
      const [iamUser] = await db
        .select()
        .from(iamUsers)
        .where(eq(iamUsers.keycloakId, payload.sub as string))
        .limit(1);

      const tenant = iamUser?.tenant ?? null;

      res.json({
        valid: true,
        user: {
          sub: payload.sub,
          username: (payload as any).preferred_username,
          email: (payload as any).email,
          name: (payload as any).name,
          roles: clientRoles,
          realmRoles,
          groups,
          tenant,
          modules,
        },
        expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
      });
    } catch (err: any) {
      const expired = err?.code === "ERR_JWT_EXPIRED";
      return res.status(401).json({
        valid: false,
        error: expired ? "Token expirado." : "Token inválido.",
      });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
