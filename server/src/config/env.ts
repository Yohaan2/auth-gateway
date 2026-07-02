import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

// Cargar .env desde la raíz del monorepo
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  
  // Secretos
  SESSION_SECRET: z.string().min(8, "SESSION_SECRET debe tener al menos 8 caracteres"),
  
  // Base de datos (Postgres)
  DATABASE_URL: z.string().url(),
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string().default("postgres"),
  DB_PASSWORD: z.string().default("postgres"),
  DB_NAME: z.string().default("auth_optrax"),

  // Keycloak
  KEYCLOAK_URL: z.string().url(),
  KEYCLOAK_INTERNAL_URL: z.string().url().optional(),
  KEYCLOAK_REALM: z.string(),
  KEYCLOAK_CLIENT_ID: z.string(),
  KEYCLOAK_CLIENT_SECRET: z.string(),
  KEYCLOAK_REDIRECT_URI: z.string().url(),
  KEYCLOAK_POST_LOGOUT_REDIRECT_URI: z.string().url().optional(),
});

// Validar variables de entorno de manera segura al arrancar
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Error de configuración en las variables de entorno:");
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
