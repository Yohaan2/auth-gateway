import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";
import path from "path";

// Cargar variables de entorno desde el .env de la raíz del monorepo
dotenv.config({ path: path.resolve(__dirname, "../.env") });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/auth_optrax",
  },
});
