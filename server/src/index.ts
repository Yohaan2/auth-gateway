import express from "express";
import { createServer } from "http";
import session from "express-session";
import cors from "cors";
import { sdk } from "./tracing";

// Configuración y variables de entorno
import { env } from "./config/env";

// Logger y middlewares
import { logger, httpLogger } from "./middlewares/logger";
import { errorHandler } from "./middlewares/errorHandler";
import { defaultLimiter } from "./middleware/rate-limiter";

// Base de datos
import { checkDbConnection, pool } from "./db/client";

// Bootstrap inicial
import { bootstrapAdminUser } from "./services/bootstrap.service";

// Rutas de autenticación (legacy session-based)
import authRouter from "./auth/routes";

// Nuevas rutas del Admin Manager
import dashboardRouter from "./routes/dashboard";
import usersRouter from "./routes/users";
import rolesRouter from "./routes/roles";
import clientsRouter from "./routes/clients";
import templatesRouter from "./routes/templates";
import tenantsRouter from "./routes/tenants";
import auditLogsRouter from "./routes/audit-logs";

// Módulo IAM — Fase 1: roles administrativos, RBAC y endpoint /me
import iamRouter from "./routes/iam";

// Gateway público (login de módulos externos)
import gatewayRouter from "./routes/gateway";
import gatewayAdminRouter from "./routes/gateway-admin";

// Servidor estático de producción
import { serveStatic } from "./static";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  // Solo Nginx (un salto) puede establecer la IP y el esquema originales.
  app.set("trust proxy", 1);

  app.get("/api/health/live", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/health", async (_req, res) => {
    try {
      const connected = await checkDbConnection();
      res.status(connected ? 200 : 503).json({
        status: connected ? "ok" : "unavailable",
        database: connected ? "connected" : "disconnected",
      });
    } catch {
      res.status(503).json({ status: "unavailable", database: "disconnected" });
    }
  });

  // 1. Rate limiter global
  app.use(defaultLimiter);

  // 2. Configuración de CORS
  app.use(
    cors({
      origin: [env.APP_URL, env.FRONTEND_URL].filter(Boolean),
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    })
  );

  // Parsers para JSON y URL-encoded
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 3. Configuración del logger HTTP
  app.use(httpLogger);

  // 4. Configuración del almacenamiento de sesión (express-session)
  // Sesiones compartidas en PostgreSQL en producción.
  let sessionStore: session.Store | undefined;

  if (env.NODE_ENV === "production") {
    const PgSession = require("connect-pg-simple")(session);
    sessionStore = new PgSession({
      pool: pool,
      tableName: "session", // Requiere crear la tabla en la base de datos (ver README)
      createTableIfMissing: true,
    });
  } else {
    logger.info("Usando MemoryStore para sesiones (desarrollo).");
  }

  app.use(
    session({
      store: sessionStore,
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: env.NODE_ENV === "production" && env.APP_URL.startsWith("https"),
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 horas
        sameSite: "lax",
      },
    })
  );

  // No aceptar tráfico si la base de datos no está disponible al iniciar.
  const dbConnected = await checkDbConnection();
  if (!dbConnected) {
    throw new Error("PostgreSQL no está disponible al iniciar.");
  }
  if (env.ENABLE_ADMIN_BOOTSTRAP) {
    await bootstrapAdminUser();
  }

  // Rutas legacy de autenticación por sesión
  app.use("/api/auth", authRouter);

  // Rutas del Auth Manager (JWT Bearer requerido)
  app.use("/api/admin/dashboard", dashboardRouter);
  app.use("/api/admin/users", usersRouter);
  app.use("/api/admin/roles", rolesRouter);
  app.use("/api/admin/clients", clientsRouter);
  app.use("/api/admin/templates", templatesRouter);
  app.use("/api/admin/tenants", tenantsRouter);
  app.use("/api/admin/audit-logs", auditLogsRouter);
  app.use("/api/admin/gateway/clients", gatewayAdminRouter);

  // Módulo IAM — Fase 1 (roles administrativos globales + RBAC)
  app.use("/api/iam", iamRouter);

  // Gateway público — para login de módulos externos (sin JWT del panel)
  app.use("/api/gateway", gatewayRouter);

  // 7. Integración con el Frontend (React + Vite / Estáticos)
  if (env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // 8. Middleware de manejo de errores centralizado (Debe estar al final de los routes/middlewares)
  app.use(errorHandler);

  // 9. Iniciar el servidor HTTP
  httpServer.listen(env.PORT, () => {
    logger.info(`Servidor Express levantado con éxito en: ${env.APP_URL}`);
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      httpServer.close(async () => {
        try {
          await pool.end();
          await sdk?.shutdown();
          process.exit(0);
        } catch (error) {
          logger.error({ error }, "Error al detener el servidor.");
          process.exit(1);
        }
      });
    });
  }
}

// Arrancar el backend de forma segura atrapando errores no controlados
startServer().catch((error) => {
  console.error("Error fatal al arrancar el servidor Express:", error);
  process.exit(1);
});
