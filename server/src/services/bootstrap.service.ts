import { db } from "../db/client";
import { iamUsers } from "../db/schema";
import { kcAdmin } from "./keycloak-admin.service";
import { logger } from "../middlewares/logger";
import { eq } from "drizzle-orm";
import crypto from "crypto";

/**
 * Desempaqueta y formatea errores de Axios para revelar la respuesta detallada de Keycloak.
 */
function formatAxiosError(err: any): string {
  if (err && err.isAxiosError) {
    const status = err.response?.status;
    const data = err.response?.data;
    return `AxiosError [Status ${status}]: ${err.message}${data ? ` | Detalles: ${JSON.stringify(data)}` : ""}`;
  }
  return err instanceof Error ? err.stack || err.message : String(err);
}

/**
 * Función de bootstrap para crear el usuario Super Administrador inicial.
 * Se ejecuta una sola vez al arrancar la aplicación si no existe ningún usuario en la tabla iam_users.
 */
export async function bootstrapAdminUser(): Promise<void> {
  try {
    // 1. Comprobar si ya existe algún usuario en la base de datos IAM
    const existingUsers = await db.select().from(iamUsers).limit(1);
    if (existingUsers.length > 0) {
      logger.info("Bootstrap: El usuario Super Admin ya existe en la base de datos.");
      return;
    }

    const username = "admin@optrax.com";
    const email = "admin@optrax.com";
    const firstName = "Super";
    const lastName = "Admin";
    
    // Generar contraseña aleatoria de 12 caracteres
    const password = crypto.randomBytes(6).toString("hex");

    // 2. Crear el usuario en Keycloak
    const userPayload = {
      username,
      email,
      firstName,
      lastName,
      enabled: true,
      emailVerified: true,
      credentials: [
        {
          type: "password",
          value: password,
          temporary: false,
        },
      ],
    };

    // Intentamos buscar si ya existe en Keycloak por si acaso (para evitar conflictos de duplicado)
    let keycloakId = "";
    try {
      const [existingKcUser] = await kcAdmin.listUsers({ username });
      if (existingKcUser) {
        keycloakId = existingKcUser.id;
        // Resetear password
        await kcAdmin.resetPassword(keycloakId, password, false);
      } else {
        keycloakId = await kcAdmin.createUser(userPayload);
        logger.info(`Bootstrap: Usuario creado en Keycloak con ID: ${keycloakId}`);
      }
    } catch (err) {
      // Si falla listUsers o createUser
      logger.error(`Bootstrap: Error al verificar o crear el usuario en Keycloak. Reintentando creación directa... Detalle: ${formatAxiosError(err)}`);
      try {
        keycloakId = await kcAdmin.createUser(userPayload);
      } catch (directErr) {
        throw new Error(`Fallo en creación directa del usuario: ${formatAxiosError(directErr)}`);
      }
    }

    if (!keycloakId) {
      throw new Error("No se pudo obtener el ID del usuario de Keycloak.");
    }

    // 3. Asignar el rol SUPER_ADMIN en Keycloak
    try {
      const superAdminRole = await kcAdmin.getRealmRole("SUPER_ADMIN");
      if (superAdminRole) {
        await kcAdmin.addRealmRolesToUser(keycloakId, [superAdminRole]);
      } else {
        logger.warn("Bootstrap: No se encontró el rol SUPER_ADMIN en Keycloak. Se omite la asignación del rol.");
      }
    } catch (roleErr) {
      logger.error(`Bootstrap: Error al asignar el rol SUPER_ADMIN en Keycloak: ${formatAxiosError(roleErr)}`);
    }

    // 4. Registrar en la base de datos del IAM
    await db.insert(iamUsers).values({
      keycloakId,
      username,
      email,
      firstName,
      lastName,
      enabled: true,
    });

    // 5. Imprimir credenciales de forma muy llamativa en consola
    console.log("\n" + "=".repeat(60));
    console.log("🚀  CREDANCIALES DEL SUPER ADMINISTRADOR INICIAL CREADAS  🚀");
    console.log("=".repeat(60));
    console.log(`📧  Email/Usuario : ${username}`);
    console.log(`🔑  Contraseña    : ${password}`);
    console.log("=".repeat(60));
    console.log("=".repeat(60) + "\n");

  } catch (error) {
    logger.error(`Bootstrap: Error crítico al inicializar el usuario Super Admin: ${formatAxiosError(error)}`);
  }
}
