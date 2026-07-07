import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

// Cargar variables de entorno desde el archivo .env de la raíz
dotenv.config();

export default defineConfig({
  schema: "./server/src/db/schema.ts",
  out: "./server/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/auth_optrax",
  },
});
