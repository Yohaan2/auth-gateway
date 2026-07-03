import rateLimit from "express-rate-limit";

export const defaultLimiter = rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Intente de nuevo en un minuto." },
});

export const sensitiveLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes en operaciones sensibles. Intente de nuevo en un minuto." },
});
