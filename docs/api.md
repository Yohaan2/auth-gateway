# API de Auth Gateway

El contrato HTTP verificable está en [`../openapi/openapi.yaml`](../openapi/openapi.yaml).
Se deriva de los routers montados en `server/src/index.ts`.

## Autenticación

- Las rutas administrativas montadas bajo `/api/admin` y `/api/iam` usan JWT Bearer
  mediante el middleware `requireJwt`; los guards adicionales se aplican en cada
  router.
- `/api/auth/me` usa la sesión de Express creada por el flujo OIDC; se representa
  como cookie `connect.sid`.
- Las rutas de `/api/gateway` no reciben automáticamente seguridad global; la
  especificación solo declara Bearer cuando el controlador inspecciona
  `Authorization`.

No se documentan secretos ni valores de entorno.
