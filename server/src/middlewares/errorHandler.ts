import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

export interface CustomError extends Error {
  statusCode?: number;
  details?: any;
}

/**
 * Middleware centralizado de manejo de errores para Express.
 * Captura cualquier error lanzado en las rutas y devuelve un JSON uniforme.
 */
export function errorHandler(
  err: CustomError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Ha ocurrido un error interno en el servidor.";
  
  // Registrar el error detalladamente con nuestro logger estructurado
  logger.error({
    msg: `🔥 Error capturado: ${message}`,
    error: {
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      statusCode,
      details: err.details,
    },
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
    }
  });

  res.status(statusCode).json({
    error: {
      message,
      statusCode,
      // Ocultar detalles del error (como el stack trace) en producción
      details: process.env.NODE_ENV === "development" ? err.details || err.stack : undefined,
    },
  });
}
