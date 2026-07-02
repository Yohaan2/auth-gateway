import pino from "pino";
import pinoHttp from "pino-http";
import { env } from "../config/env";

// Configurar logger de Pino
export const logger = pino({
  level: env.NODE_ENV === "development" ? "debug" : "info",
  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname,req,res,responseTime",
            messageFormat: "{msg}",
          },
        }
      : undefined,
});

// Middleware de registro de peticiones HTTP para Express
export const httpLogger = pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => {
      const url = (req as any).originalUrl || (req as any).url || "";
      return url.startsWith("/@") || url.startsWith("/node_modules/") || url.includes("__vite");
    },
  },
  customLogLevel: function (_req, res, err) {
    const statusCode = res.statusCode;
    if (statusCode >= 500 || err) return "error";
    if (statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage: function (req, res) {
    return `${req.method} ${(req as any).originalUrl || req.url} ${res.statusCode} ${(res as any).responseTime || 0}ms`;
  },
  customErrorMessage: function (req, res) {
    return `${req.method} ${(req as any).originalUrl || req.url} ${res.statusCode} ${(res as any).responseTime || 0}ms`;
  },
  serializers: {
    req() { return undefined; },
    res() { return undefined; },
  },
});
