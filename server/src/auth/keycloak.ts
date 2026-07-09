import { Issuer, type Client } from "openid-client";
import { env } from "../config/env";

let keycloakClient: Client | null = null;

/**
 * Inicializa y devuelve de manera perezosa (lazy-loading) el cliente de OpenID Connect para Keycloak.
 * Utiliza KEYCLOAK_INTERNAL_URL para la comunicación backend-to-backend si está definida.
 */
export async function getKeycloakClient(): Promise<Client> {
  if (keycloakClient) {
    return keycloakClient;
  }

  try {
    const keycloakBaseUrl = env.KEYCLOAK_INTERNAL_URL || env.KEYCLOAK_URL;
    const issuerUrl = `${keycloakBaseUrl}/realms/${env.KEYCLOAK_REALM}`;

    console.log(`🔌 Descubriendo configuración de Keycloak en: ${issuerUrl}...`);
    const keycloakIssuer = await Issuer.discover(issuerUrl);

    keycloakClient = new keycloakIssuer.Client({
      client_id: env.KEYCLOAK_CLIENT_ID,
      client_secret: env.KEYCLOAK_CLIENT_SECRET,
      redirect_uris: [env.KEYCLOAK_REDIRECT_URI],
      post_logout_redirect_uris: env.KEYCLOAK_POST_LOGOUT_REDIRECT_URI
        ? [env.KEYCLOAK_POST_LOGOUT_REDIRECT_URI]
        : [env.APP_URL],
      response_types: ["code"],
    });

    console.log("✅ Cliente de Keycloak inicializado con éxito.");
    return keycloakClient;
  } catch (error) {
    console.error("❌ Error inicializando el cliente de Keycloak:", error);
    throw error;
  }
}
