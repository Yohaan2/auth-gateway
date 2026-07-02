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
            ignore: "pid,hostname",
          },
        }
      : undefined,
});

// Middleware de registro de peticiones HTTP para Express
export const httpLogger = pinoHttp({
  logger,
  // Deshabilitar logs de peticiones exitosas repetitivas si se desea reducir ruido
  autoLogging: true,
  customLogLevel: function (res, err) {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return "warn";
    } else if (res.statusCode >= 500 || err) {
      return "error";
    }
    return "info";
  },
});
