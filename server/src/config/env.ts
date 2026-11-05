import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

// Cargar .env desde la raíz del monorepo
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),

  // Secretos de sesión (flujo legacy, se mantiene por compatibilidad)
  SESSION_SECRET: z.string().min(8, "SESSION_SECRET debe tener al menos 8 caracteres"),
  ENABLE_ADMIN_BOOTSTRAP: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  LOCAL_HTTP_ONLY: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),

  // Base de datos (Postgres)
  DATABASE_URL: z.string().url(),
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string().default("postgres"),
  DB_PASSWORD: z.string().default("postgres"),
  DB_NAME: z.string().default("auth_optrax"),

  // Keycloak — URL pública (para el navegador) e interna (para llamadas backend)
  KEYCLOAK_URL: z.string().url(),
  KEYCLOAK_INTERNAL_URL: z.preprocess((v) => (v === "" ? undefined : v), z.string().url().optional()),
  KEYCLOAK_REALM: z.string(),
  // Clientes que pueden invocar la API administrativa del panel.
  KEYCLOAK_ALLOWED_CLIENT_IDS: z.string().default(""),

  // Auth Manager Client (flujo legacy de sesión)
  KEYCLOAK_CLIENT_ID: z.string(),
  KEYCLOAK_CLIENT_SECRET: z.string(),
  KEYCLOAK_REDIRECT_URI: z.string().url(),
  KEYCLOAK_POST_LOGOUT_REDIRECT_URI: z.preprocess((v) => (v === "" ? undefined : v), z.string().url().optional()),

  // Service Account — usado por el backend para llamar a la Admin REST API
  KEYCLOAK_SA_CLIENT_ID: z.string(),
  KEYCLOAK_SA_CLIENT_SECRET: z.string(),

  // Roles internos del Auth Manager
  KEYCLOAK_ADMIN_ROLE: z.string().default("auth-manager-admin"),
  KEYCLOAK_VIEWER_ROLE: z.string().default("auth-manager-viewer"),

  // CORS — origen del frontend (en desarrollo es el mismo servidor)
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
});

// Validar variables de entorno de manera segura al arrancar
const parsed = envSchema.superRefine((config, ctx) => {
  if (config.NODE_ENV === "production" && config.SESSION_SECRET.length < 32) {
    ctx.addIssue({ code: "custom", path: ["SESSION_SECRET"], message: "Se requieren al menos 32 caracteres en producción." });
  }
  if (config.NODE_ENV === "production" && config.ENABLE_ADMIN_BOOTSTRAP) {
    ctx.addIssue({ code: "custom", path: ["ENABLE_ADMIN_BOOTSTRAP"], message: "El bootstrap automático no está permitido en producción." });
  }
  if (config.NODE_ENV === "production" && !config.KEYCLOAK_ALLOWED_CLIENT_IDS.trim()) {
    ctx.addIssue({ code: "custom", path: ["KEYCLOAK_ALLOWED_CLIENT_IDS"], message: "Defina los clientes autorizados para la API administrativa." });
  }
  const localhostHttp = config.LOCAL_HTTP_ONLY &&
    [config.APP_URL, config.FRONTEND_URL, config.KEYCLOAK_URL].every((value) => {
      const url = new URL(value);
      return url.protocol === "http:" && url.hostname === "localhost";
    });
  if (config.LOCAL_HTTP_ONLY && !localhostHttp) {
    ctx.addIssue({ code: "custom", path: ["LOCAL_HTTP_ONLY"], message: "HTTP local solo permite URLs http://localhost." });
  }
  if (config.NODE_ENV === "production" && !localhostHttp &&
      (!config.APP_URL.startsWith("https://") || !config.KEYCLOAK_URL.startsWith("https://"))) {
    ctx.addIssue({ code: "custom", message: "APP_URL y KEYCLOAK_URL deben usar HTTPS en producción." });
  }
}).safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Error de configuración en las variables de entorno:");
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
