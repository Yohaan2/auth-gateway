# Despliegue sin dominio (solo IP, HTTP)

Para un servidor sin DNS ni certificados TLS.

## ¿Localhost o IP?

| Modo | Compose | Nginx | Cómo entras |
|------|---------|-------|-------------|
| **Desarrollo local** | `docker-compose.local.yml` | `local.conf` | `http://127.0.0.1:19080` (solo esta máquina) |
| **Servidor por IP** | `docker-compose.no-domain.yml` | `default.no-domain.conf` | `http://<IP-del-VPS>/` desde cualquier cliente |

El compose **`docker-compose.no-domain.yml`** publica **`80:80` en todas las interfaces** (`0.0.0.0`).
No uses `localhost` en el `.env` salvo que solo pruebes en el mismo host; los
navegadores y otros servidores deben usar la **IP pública** (o la IP LAN si es
red interna).

Nginx expone la app en `/` y Keycloak en `/auth/`.

## 1. Variables en `.env`

Sustituye `203.0.113.10` por la IP pública (o la que usen los clientes):

```dotenv
NODE_ENV=production
APP_URL=http://203.0.113.10
FRONTEND_URL=http://203.0.113.10
KEYCLOAK_URL=http://203.0.113.10/auth
KEYCLOAK_INTERNAL_URL=http://keycloak:8080/auth
VITE_KEYCLOAK_URL=http://203.0.113.10/auth
```

El resto de secretos y Postgres igual que en `DESPLIEGUE_PRODUCCION.md`.
El compose no-domain define `INSECURE_HTTP=true` y `KEYCLOAK_ALLOWED_CLIENT_IDS` por defecto en el servicio `app`.

## 2. Build y arranque

Compose ejecuta **`realm-prepare`** antes de Keycloak (genera `docker/generated/realm.json` desde `.env`).
No hace falta Node en el host.

```bash
# Obligatorio desde la raíz del repo (si no, KC_HOSTNAME puede quedar con una IP vieja):
docker compose --env-file .env --project-directory . \
  -f docker/docker-compose.no-domain.yml build
docker compose --env-file .env --project-directory . \
  -f docker/docker-compose.no-domain.yml up -d
```

Comprueba **antes** de confiar en el navegador:

```bash
sudo docker exec auth-optrax-keycloak printenv KC_HOSTNAME KC_HTTP_RELATIVE_PATH
# KC_HOSTNAME = KEYCLOAK_URL (con /auth), p. ej. http://10.232.102.118/auth

docker compose --env-file .env --project-directory . \
  -f docker/docker-compose.no-domain.yml config | grep KC_HOSTNAME
```

Si sigue saliendo otra IP, revisa que **no** exista `docker/.env` antiguo (`rm -f docker/.env`).
Corrige también `FRONTEND_URL` (debe coincidir con `APP_URL`, no otro octeto).

Opcional en local con Node: `node docker/prepare-realm.cjs .env`

## 3. Nginx usado

Archivo **`nginx/default.no-domain.conf`** (no `default.conf`, que asume HTTPS y
certificados en `docker/certs/`).

## 4. Redirección a una IP/host antigua (p. ej. iBMC)

Keycloak guarda `frontend_url` en Postgres. Si el navegador salta a otra IP tras
cambiar `.env`, ejecuta desde la raíz del repo:

```bash
bash docker/fix-keycloak-hostname.sh
docker compose --env-file .env --project-directory . \
  -f docker/docker-compose.no-domain.yml up -d --force-recreate keycloak
docker restart auth-optrax-nginx
```

Comprueba en `.env` que `KEYCLOAK_URL` sea `http://<IP>/auth` **sin** `:8000` ni `:3000`.

## 5. `ERR_TOO_MANY_REDIRECTS` en el navegador

El stack **solo expone HTTP en el puerto 80**. Si la barra de direcciones muestra
**`https://`**, Chrome puede entrar en bucle (cookies de intentos anteriores o
acceso desde la consola **iBMC**, que usa otra IP).

1. Abre en ventana privada y escribe **a mano**: `http://10.232.102.118/auth/admin/`
   (con **`http://`**, no dejes que el navegador ponga `https`).
2. Pulsa **Eliminar cookies** en la página de error o borra datos del sitio para
   esa IP.
3. Prueba desde otro navegador o PC (no solo la pestaña embebida del iBMC).

En el servidor, la cadena no debe repetirse:

```bash
# El primer 302 debe ir a .../admin/master/console/, NO al mismo /admin/
curl -sI http://10.232.102.118/auth/admin/ | grep -E '^(HTTP|Location:)'
curl -sI http://10.232.102.118/auth/admin/master/console/ | grep -E '^(HTTP|Location:)'
```

Tras cambiar nginx: `docker restart auth-optrax-nginx`.

## 6. Dos URLs distintas (no mezclar)

| Qué quieres | URL |
|-------------|-----|
| **Consola Keycloak** (crear usuarios, realm) | `http://<IP>/auth/admin/` |
| **Auth Manager** (panel optrax, login OIDC) | `http://<IP>/` |

Si caes en `/admin/` con error *accept header…*, es la SPA: usa **`/auth/admin/`** o
actualiza nginx y Keycloak (`git pull`, recrea `keycloak`, `restart nginx`).

## 7. Limitaciones

- Todo el tráfico va en **HTTP**; no usar en Internet abierto sin otra capa de seguridad.
- Los redirect URIs de los clientes Keycloak deben coincidir con `APP_URL` y rutas OIDC.
- Si cambias la IP o el puerto, actualiza `.env`, regenera el realm si aplica y **reconstruye** la imagen `app` (`VITE_*`).
