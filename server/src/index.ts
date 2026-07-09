import express from "express";
import { createServer } from "http";
import session from "express-session";
import cors from "cors";

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
  // Por defecto usa MemoryStore en desarrollo. Se provee la configuración para PostgreSQL
  // usando 'connect-pg-simple' lista para descomentar en producción.
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

  // Probar la conexión a la base de datos y crear tablas si no existen
  const dbConnected = await checkDbConnection();
  if (dbConnected) {
    // Ejecutar el bootstrap de usuario administrador inicial
    await bootstrapAdminUser();
  } else {
    logger.warn("No se pudo establecer conexión inmediata a PostgreSQL. Reintente más tarde.");
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
  app.use("/api/admin/gateway/clients", gatewayAdminRouter);

  // Módulo IAM — Fase 1 (roles administrativos globales + RBAC)
  app.use("/api/iam", iamRouter);

  // Gateway público — para login de módulos externos (sin JWT del panel)
  app.use("/api/gateway", gatewayRouter);

  // Health Check
  app.get("/api/health", async (_req, res) => {
    res.status(200).json({
      status: "ok",
      environment: env.NODE_ENV,
      database: dbConnected ? "connected" : "disconnected",
    });
  });

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
}

// Arrancar el backend de forma segura atrapando errores no controlados
startServer().catch((error) => {
  console.error("Error fatal al arrancar el servidor Express:", error);
  process.exit(1);
});
