import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env";
import * as schema from "./schema";

// Configurar el pool de conexión para PostgreSQL
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

// Instanciar Drizzle ORM
export const db = drizzle(pool, { schema });

// Función de Health Check para la Base de Datos
export async function checkDbConnection(): Promise<boolean> {
  try {
    const res = await pool.query("SELECT to_regclass('public.iam_users') IS NOT NULL AS ready");
    if (res.rows[0]?.ready === true) {
      return true;
    }
    return false;
  } catch (error) {
    console.error("❌ Error de conexión con la Base de Datos PostgreSQL:", error);
    return false;
  }
}
