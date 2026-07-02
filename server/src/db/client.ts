import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env";
import * as schema from "./schema";

// Configurar el pool de conexión para PostgreSQL
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

// Instanciar Drizzle ORM
export const db = drizzle(pool, { schema });

// Función de Health Check para la Base de Datos
export async function checkDbConnection(): Promise<boolean> {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT 1 as connection_test");
    if (res.rows && res.rows[0]?.connection_test === 1) {
      return true;
    }
    return false;
  } catch (error) {
    console.error("❌ Error de conexión con la Base de Datos PostgreSQL:", error);
    return false;
  } finally {
    client.release();
  }
}
