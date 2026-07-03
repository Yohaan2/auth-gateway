import type { Request, Response, NextFunction } from "express";
import { isAxiosError } from "axios";
import { logger } from "./logger";

export interface CustomError extends Error {
  statusCode?: number;
  details?: any;
}

// Traduce errores de la Admin REST API de Keycloak a mensajes legibles
function translateKeycloakError(kcStatus: number, body: any): { status: number; message: string } {
  const errorMsg: string = body?.errorMessage || body?.error_description || body?.error || "";

  if (kcStatus === 409) {
    if (errorMsg.toLowerCase().includes("username")) {
      return { status: 409, message: "Ya existe un usuario con ese nombre de usuario." };
    }
    if (errorMsg.toLowerCase().includes("email")) {
      return { status: 409, message: "Ya existe un usuario con ese correo electrónico." };
    }
    return { status: 409, message: "El recurso ya existe en Keycloak." };
  }

  if (kcStatus === 404) return { status: 404, message: "Recurso no encontrado en Keycloak." };
  if (kcStatus === 400) return { status: 400, message: `Datos inválidos: ${errorMsg || "revise los campos enviados."}` };
  if (kcStatus === 401) {
    // 401 en el endpoint de token = credenciales inválidas del service account
    // 401 en otros endpoints = token de servicio expirado (se reintentará automáticamente)
    const isTokenEndpoint = (body?.error === "unauthorized_client") || errorMsg.includes("Invalid client");
    const msg = isTokenEndpoint
      ? "Credenciales del service account inválidas. Verifique KEYCLOAK_SA_CLIENT_SECRET en .env."
      : "El token de servicio expiró. Reintente la operación.";
    return { status: 502, message: msg };
  }
  if (kcStatus === 403) return { status: 403, message: "La service account no tiene permisos suficientes en Keycloak." };

  return { status: 502, message: `Error de Keycloak (${kcStatus}): ${errorMsg || "error desconocido."}` };
}

export function errorHandler(err: CustomError, req: Request, res: Response, _next: NextFunction) {
  // Errores provenientes de llamadas axios a Keycloak
  if (isAxiosError(err)) {
    const kcStatus = err.response?.status ?? 502;
    const kcBody = err.response?.data;
    const translated = translateKeycloakError(kcStatus, kcBody);

    logger.warn({
      msg: `Keycloak error: ${translated.message}`,
      kcStatus,
      url: err.config?.url,
      method: err.config?.method,
    });

    return res.status(translated.status).json({ error: translated.message });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || "Ha ocurrido un error interno en el servidor.";

  logger.error({
    msg: `Error capturado: ${message}`,
    error: {
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      statusCode,
    },
    request: { method: req.method, url: req.url },
  });

  res.status(statusCode).json({
    error: message,
    details: process.env.NODE_ENV === "development" ? err.details || err.stack : undefined,
  });
}
