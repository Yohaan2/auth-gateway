# Despliegue en servidores fisicos

Esta guia parte de una instalacion **nueva**. No aplica cambios automaticos
a una base o un realm existentes. El hostname configurado en Compose/Nginx
es `auth.optrax.io`: DNS interno debe resolverlo para los usuarios y todos
los modulos que usan Keycloak.

## 1. Preparar infraestructura

- Instalar Docker Engine y el plugin `docker compose` para Linux. Permitir
  443 solo desde redes internas autorizadas (80 opcional para redireccion).
  PostgreSQL, Keycloak y Express no publican puertos.
- Instalar un certificado de CA interna en `docker/certs/fullchain.pem` y
  su clave en `docker/certs/privkey.pem`. Distribuir la CA a navegadores,
  servidores y modulos; proteger la clave. No usar certificados de `smoke`.
- Reservar almacenamiento persistente para el volumen `pgdata` y backups
  verificados de **ambas** bases, `auth_optrax` y `keycloak`.

## 2. Configurar secretos y el realm

En una estacion segura con Node.js, copiar `.env.example` a `.env` y
completarlo. Generar **cada** password/secret distinto con
`openssl rand -hex 32`; no poner secretos en comandos de build ni commits.
Valores esenciales para Docker:

```dotenv
NODE_ENV=production
APP_URL=https://auth.optrax.io
FRONTEND_URL=https://auth.optrax.io
KEYCLOAK_URL=https://auth.optrax.io/auth
KEYCLOAK_INTERNAL_URL=http://keycloak:8080/auth
KEYCLOAK_REALM=optrax-realm
KEYCLOAK_ALLOWED_CLIENT_IDS=optrax-frontend
KEYCLOAK_CLIENT_ID=optrax-app
KEYCLOAK_SA_CLIENT_ID=auth-manager-sa
KEYCLOAK_ADMIN_ROLE=SUPER_ADMIN
KEYCLOAK_VIEWER_ROLE=AUDITOR
ENABLE_ADMIN_BOOTSTRAP=false
POSTGRES_USER=postgres
POSTGRES_DB=auth_optrax
DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@postgres:5432/auth_optrax
KC_DB_URL=jdbc:postgresql://postgres:5432/keycloak
KC_DB_USERNAME=postgres
VITE_KEYCLOAK_URL=https://auth.optrax.io/auth
VITE_KEYCLOAK_REALM=optrax-realm
VITE_KEYCLOAK_CLIENT_ID=optrax-frontend
VITE_ADMIN_ROLE=SUPER_ADMIN
VITE_VIEWER_ROLE=AUDITOR
```

Agregar `POSTGRES_PASSWORD`, `KC_DB_PASSWORD` (el mismo password),
`SESSION_SECRET`, `KEYCLOAK_CLIENT_SECRET`,
`KEYCLOAK_SA_CLIENT_SECRET` y las URL de redireccion de Keycloak. Para el
**primer** arranque configurar `KC_BOOTSTRAP_ADMIN_USERNAME` y
`KC_BOOTSTRAP_ADMIN_PASSWORD` aleatorios para la consola master. No poner
passwords en `VITE_*`: se publican en el navegador.

En esa estacion ejecutar `node docker/prepare-realm.cjs .env`. Transferir
el archivo ignorado `docker/generated/realm.json` de forma segura al host.
Contiene los secrets de `optrax-app` y `auth-manager-sa`: el JSON versionado
es solo una plantilla sin claves utilizables. Si el realm ya existe,
Keycloak **ignora el import**: actualizar sus secretos en la consola,
sincronizarlos con `.env` y los clientes del gateway. Verificar tambien que
los clientes `optrax-frontend` y `optrax-app` tengan el scope `basic` con
mapper de `sub`; sin ese claim la API rechaza los access tokens. Esto es rotar
secretos: reemplazar los antiguos en ambas puntas. Los valores historicos
del repositorio deben considerarse comprometidos.

## 3. Construir las imagenes

El servidor tiene acceso a Internet, por lo que Compose descarga
`postgres`, `keycloak` y `nginx` y construye la app por si mismo. Las
variables `VITE_*` se leen del `.env` y se pasan al build como `build.args`
(Vite las incrusta en el JavaScript durante la compilacion, no en runtime).
Si se cambian, hay que reconstruir la imagen.

Desde la raiz del proyecto en el servidor:

```bash
docker compose -f docker/docker-compose.yml build app
```

Conservar la imagen anterior (`auth-optrax-app:1.0.0`) para rollback
etiquetandola antes de reconstruir, y fijar imagenes base por digest en un
release formal.

> Servidor **sin** Internet: construir en una maquina con Internet y la misma
> arquitectura CPU, ejecutar `docker compose -f docker/docker-compose.yml
> build app` y `docker compose -f docker/docker-compose.yml pull postgres
> keycloak nginx`, luego `docker save -o auth-optrax-images.tar
> auth-optrax-app:1.0.0 postgres:15-alpine quay.io/keycloak/keycloak:26.6.4
> nginx:alpine`. Transferir el tar con su `sha256sum`, verificar y ejecutar
> `docker load -i`. En ese caso arrancar con `--no-build --pull never`.

## 4. Arrancar y comprobar

Desde la raiz del proyecto, con `.env`, `docker/generated/realm.json` y
los certificados instalados:

```bash
docker compose -f docker/docker-compose.yml config --quiet
docker compose -f docker/docker-compose.yml up -d
docker compose -f docker/docker-compose.yml ps
curl --fail --cacert /ruta/ca-interna.pem https://auth.optrax.io/api/health
curl --fail --cacert /ruta/ca-interna.pem \
  https://auth.optrax.io/auth/realms/optrax-realm/.well-known/openid-configuration
```

Con **volumen nuevo**, PostgreSQL crea la DB `keycloak` y aplica
`0000_productive_selene.sql` y `production-iam-users.sql` a `auth_optrax`.
La app no arranca sin `iam_users`. Con volumen **existente** no se ejecutan
scripts init: respaldar, comprobar esquema y aplicar solo migracion faltante
antes de arrancar. No usar `docker compose down -v` en produccion.

Los realm roles `access-core` (Módulo de Core) y `access-perceiver`
(Módulo de Perceiver) están definidos en el seed del realm. Keycloak
solo importa ese seed si el realm todavía no existe; si ya existe,
hay que agregar los roles allí manualmente. No se asignan
automáticamente a usuarios.

Entrar en `/auth/admin` con el administrador temporal master. Crear admin
permanente master y usuario del realm `optrax-realm` con rol `SUPER_ADMIN`
para el panel; probar login en navegador que confie en la CA. Retirar el
admin temporal master. Configurar un cliente OIDC por modulo (preferir
Authorization Code + PKCE) y validar firma, `iss`, `exp` y `aud` en cada API.
El issuer debe ser exactamente
`https://auth.optrax.io/auth/realms/optrax-realm`.

## 5. Criterios antes de abrir a usuarios

- Probar backup/restauracion de ambas bases, TLS y login/refresh/logout
  desde cada modulo. La comprobacion local de solo lectura no prueba
  credenciales reales.
- Hacer prueba de carga con 100 usuarios virtuales y trafico representativo;
  registrar p95, 5xx/429, CPU/memoria y conexiones DB/Keycloak.
- Un solo host Compose no da alta disponibilidad ni autoescalado. El rate
  limiter usa memoria; antes de replicar app hay que compartir su estado.
  El gateway aun no valida `aud` y usa password grant: migrar a PKCE.
- Auditar dependencias y aplicar actualizaciones controladas antes del
  release. Contenedores `healthy` no bastan para declarar produccion lista.

## Prueba aislada local

La prueba usa volumen y contenedores `*-smoke`, puertos 18080/18443
**solo en localhost** y credenciales aleatorias en `docker/smoke/`.
Nunca usar `.env` real ni el certificado efimero en produccion.

```bash
node docker/prepare-smoke.cjs
node docker/prepare-realm.cjs docker/smoke/.env docker/smoke
# Crear certificado de prueba para auth.optrax.io en docker/smoke/certs/.
docker compose -p optrax-smoke --env-file docker/smoke/.env \
  -f docker/docker-compose.yml -f docker/docker-compose.smoke.yml \
  up -d --no-build --pull never
curl --insecure --noproxy '*' \
  --resolve auth.optrax.io:18443:127.0.0.1 \
  https://auth.optrax.io:18443/api/health
```

`node docker/smoke-test.cjs` crea **solo en esa base aislada** un usuario
temporal, registra gateway y comprueba login/refresh/logout. Ejecutarlo
solo con autorizacion explicita para esas escrituras. No usar `--insecure`
en produccion ni borrar volumenes sin verificar su contenido.
