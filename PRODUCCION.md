# Despliegue y capacidad (~100 usuarios)

Para los comandos de instalacion actualizados, ver `DESPLIEGUE_PRODUCCION.md`.
Esta pagina conserva notas de capacidad; no usar los pasos antiguos de
instalacion de esta pagina como procedimiento de despliegue.

## Estado actual y criterios de salida

No se puede afirmar capacidad para 100 usuarios concurrentes sin medir el tráfico
real (login, refresh, consultas, escrituras) sobre la infraestructura objetivo.
Un host con Compose, una instancia de cada servicio y PostgreSQL persistente
es un punto de partida para ~100 usuarios registrados o carga moderada; **no
proporciona alta disponibilidad ni autoescalado**. No habilitar autoescalado
por defecto: primero medir p95, errores, CPU, memoria y conexiones a la DB.

Antes de abrir a usuarios:

1. Obtener copia de seguridad verificada de **ambas bases** (`auth_optrax` y
   `keycloak`), ensayar restauración y definir RPO/RTO. Proteger el volumen
   `pgdata`, aplicar parches al host y permitir solo 80/443 desde redes
   internas autorizadas. El DNS interno debe resolver `auth.optrax.io` para
   navegadores, servidores y todos los módulos consumidores de Keycloak.
2. En `.env`, fijar `NODE_ENV=production`, `APP_URL` y `KEYCLOAK_URL` en
   HTTPS (el último con `/auth`), `FRONTEND_URL`, `DATABASE_URL`, valores
   `KC_DB_*`, `POSTGRES_*`, credenciales de clientes y `SESSION_SECRET` de
   al menos 32 caracteres aleatorios. Definir `VITE_KEYCLOAK_URL`,
   `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID` para el *build*; nunca
   poner secretos en variables `VITE_*`. Configurar
   `KEYCLOAK_ALLOWED_CLIENT_IDS` con el client ID del frontend (claim
   `azp` del access token), sin confundirlo con una audiencia de API.
   Mantener `ENABLE_ADMIN_BOOTSTRAP=false`.
   No copiar el `.env.example` de desarrollo tal cual.
3. Rotar los secretos históricos de clientes que estuvieron en
   `docker/keycloak-realm-export.json` y sincronizarlos
   con la configuración del backend. Revisar permisos de la service account
   y crear el primer administrador por un proceso seguro fuera del arranque
   automático. El bootstrap de desarrollo imprime credenciales en logs y no
   debe habilitarse en producción.
4. Con volumen nuevo, PostgreSQL aplica automaticamente `0000` y
   `production-iam-users.sql` a `auth_optrax`. En una instalacion existente,
   comprobar que tablas existen y aplicar solo el SQL faltante tras backup; no usar `db:push`
   sin revisar el diff, pues el snapshot antiguo aún contiene
   `template_groups`. No ejecutar scripts SQL automáticamente en cada
   réplica. La app ahora falla al arrancar si falta `iam_users`.
5. Instalar un certificado de la CA interna en
   `docker/certs/fullchain.pem` y su clave en `docker/certs/privkey.pem`
   antes de arrancar Nginx; distribuir la CA a navegadores, servidores
   y módulos. Proteger la clave y gestionar su renovación internamente:
   los scripts Certbot existentes no sirven sin Internet.
   `docker compose -f docker/docker-compose.yml config --quiet` valida
   la configuración. Iniciar con
   `docker compose -f docker/docker-compose.yml up -d --no-build --pull never`.
   Verificar `https://auth.optrax.io/api/health` (200 con DB; 503 sin DB),
   login real y logout. Los puertos de Postgres, Express y exporters no se
   publican. El perfil `monitoring` es opcional; `cadvisor` usa privilegios
   elevados y debe revisarse antes de habilitarlo.

## Entrega de imágenes sin Internet

En una máquina de build con Internet y Docker para Linux, preparar `.env`
con las variables públicas `VITE_*` correctas antes del build:

```bash
docker compose -f docker/docker-compose.yml build app
docker pull postgres:15-alpine
docker pull quay.io/keycloak/keycloak:26.6.4
docker pull nginx:alpine
docker save -o auth-optrax-images.tar auth-optrax-app:1.0.0 postgres:15-alpine quay.io/keycloak/keycloak:26.6.4 nginx:alpine
```

Transferir el tar con un canal interno y verificar su SHA-256. Copiar
configuración, SQL y certificados al servidor físico; ejecutar
`docker load -i auth-optrax-images.tar`. No subir `.env` ni claves al
repositorio. No ejecutar `npm ci`, `docker build` ni `pull` en el host
aislado. Conservar la imagen anterior para rollback y verificar que
arquitectura CPU/OS del build coincide con destino. Congelar las imágenes
base por digest para releases reproducibles (las etiquetas `alpine`
pueden cambiar).

## Medición y escalado

- Ejecutar pruebas con 100 usuarios virtuales que reproduzcan el mix real,
  ramp-up gradual, sesiones y tokens independientes, desde otro host;
  registrar p50/p95/p99, tasa de 5xx/429, CPU/memoria por contenedor,
  sesiones activas, conexiones PostgreSQL y latencia de Keycloak. Definir
  límites aceptables con el negocio antes de declarar capacidad.
- La app usa sesiones en PostgreSQL, así que se puede replicar solo detrás
  de un balanceador, con **el mismo** `SESSION_SECRET`. Cada réplica abre
  hasta 10 conexiones a la DB más las usadas por Keycloak. El rate limit
  actual usa memoria local: antes de escalar horizontalmente, reemplazarlo
  por un store compartido (p. ej. Redis) o aplicar límites en el proxy.
  Quitar `container_name` si se quieren varias réplicas con Compose; el
  Docker Compose actual no implementa autoescalado.
- Para alta disponibilidad real se requieren balanceador gestionado,
  PostgreSQL con backups/failover, Keycloak en cluster y una plataforma
  con métricas/autoscaling. No multiplicar solo la app si Keycloak o la DB
  son el cuello de botella. Dimensionar a partir de la prueba, no del número
  de cuentas.
- Keycloak será el proveedor de los otros módulos: definir un cliente OIDC
  por módulo, usar Authorization Code + PKCE y validar firma, `iss`,
  expiración y `aud` en **cada API**. El issuer debe ser idéntico en
  todas las redes (`https://auth.optrax.io/auth/realms/...`); la URL
  `KEYCLOAK_INTERNAL_URL` solo es para tráfico entre contenedores.
  Keycloak y su base son dependencias centrales: dimensionarlos y respaldarlos.

## Riesgos pendientes

- La API administrativa comprueba el cliente emisor (`azp`), la firma,
  expiración e issuer, pero no `aud`; `/api/gateway/verify` tampoco
  comprueba `aud`. Definir una audiencia de API en Keycloak, mapearla a
  los tokens de los módulos y comprobarla antes de usar tokens entre APIs.
- `/api/gateway/login` usa password grant (ROPC). Migrar clientes a
  Authorization Code + PKCE; limitar intentos en Keycloak y monitorear
  abuso de credenciales. El rate limit en memoria no sustituye este control.
- Solo hay pruebas automatizadas de configuración, no integración ni pipeline
  de release; ejecutar pruebas
  integradas contra Postgres/Keycloak reales, escaneo de dependencias e
  imagen, y prueba de restauración antes de afirmar que está listo.
- Revisar que el export del realm, hostname de Keycloak y las URLs de
  redirect coinciden con el dominio público; no asumir que el import
  modifica automáticamente un realm ya existente.
