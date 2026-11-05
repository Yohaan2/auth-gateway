# Instalar desde cero en localhost (sin certificados)

Esta configuracion es **solo para esta maquina**, por HTTP en
`http://localhost:19080`. No usa `auth.optrax.io`, no lee la `.env`
principal y no modifica los volumenes o contenedores de otras instalaciones.
No exponerla a la red: HTTP transmite contrasenas y tokens sin cifrar.

Requisitos: Docker Desktop en marcha y Node.js en la maquina de desarrollo.
En la raiz del repositorio, ejecutar una sola vez:

```bash
node docker/prepare-local.cjs
docker build -f docker/Dockerfile -t auth-optrax-app:local \
  --build-arg VITE_KEYCLOAK_URL=http://localhost:19080/auth \
  --build-arg VITE_KEYCLOAK_REALM=optrax-realm \
  --build-arg VITE_KEYCLOAK_CLIENT_ID=optrax-frontend \
  --build-arg VITE_ADMIN_ROLE=SUPER_ADMIN \
  --build-arg VITE_VIEWER_ROLE=AUDITOR .
docker compose -p optrax-local --env-file docker/local/.env \
  -f docker/docker-compose.yml -f docker/docker-compose.local.yml \
  up -d --no-build --pull never
node docker/initialize-local-admin.cjs
node docker/verify-local.cjs
```

La primera orden genera una `.env` aislada y `realm.json` con redirects
`http://localhost:19080/*`. No volver a ejecutarla sobre una instalacion
existente. Esperar a que Keycloak y la app esten sanos antes de crear el
usuario; consultar el estado con:

```bash
docker compose -p optrax-local --env-file docker/local/.env \
  -f docker/docker-compose.yml -f docker/docker-compose.local.yml ps
```

Entrar a **http://localhost:19080/**. Usuario del panel:
`admin-local`; buscar su contraseña en `LOCAL_PANEL_PASSWORD` dentro de
`docker/local/.env` (archivo ignorado por Git). El administrador de Keycloak
master es distinto y usa `KC_BOOTSTRAP_ADMIN_USERNAME` /
`KC_BOOTSTRAP_ADMIN_PASSWORD` del mismo archivo.

La verificacion comprueba la URL de retorno OIDC, las credenciales del usuario,
el rol `SUPER_ADMIN` y las consultas del dashboard. Para reiniciar sin
perder los usuarios, ejecutar solo el comando `docker compose ... up -d`
anterior; no repetir `prepare-local.cjs` ni borrar el volumen.

Este entorno usa su propio volumen `optrax-local_local_pgdata` y puerto
19080 solo en 127.0.0.1. La guia para servidores reales es
`DESPLIEGUE_PRODUCCION.md`; alli se requiere HTTPS.
