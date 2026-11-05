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
# KC_HOSTNAME = KEYCLOAK_URL (con /auth). Tras fix-keycloak-hostname.sh, master.frontend_url debe ser NULL.

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

1. Abre en ventana privada con **`http://`** (no `https`). Prueba en este orden:
   - `http://<IP>/auth/admin/master/console/`
   - `http://<IP>/auth/admin/`
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

## 8. Migrar a dominio + HTTPS (preparado, NO activo)

Hoy se usa `docker-compose.no-domain.yml` (HTTP por IP). El stack con dominio ya está
listo y es **`docker/docker-compose.yml`** + `nginx/default.conf`; el dominio sale de
`DOMAIN` y `KEYCLOAK_URL` del `.env` (nada hardcodeado). Cuando haya dominio:

1. **DNS:** registro A de `auth.tudominio.com` → IP del servidor. Abre 80 y 443.
2. **Certificado** (Let's Encrypt, con el stack parado para liberar el puerto 80):

   ```bash
   sudo docker compose --env-file .env --project-directory . -f docker/docker-compose.no-domain.yml down
   sudo certbot certonly --standalone -d auth.tudominio.com
   sudo cp /etc/letsencrypt/live/auth.tudominio.com/fullchain.pem docker/certs/fullchain.pem
   sudo cp /etc/letsencrypt/live/auth.tudominio.com/privkey.pem docker/certs/privkey.pem
   ```

   Renovación (cada ~60 días): repetir `certbot renew` y la copia, y `docker restart auth-optrax-nginx`.
   Con CA interna, basta con dejar los `.pem` en `docker/certs/`.
3. **`.env`:** todas las URLs en `https://` y el dominio nuevo:

   ```dotenv
   DOMAIN=auth.tudominio.com
   APP_URL=https://auth.tudominio.com
   FRONTEND_URL=https://auth.tudominio.com
   KEYCLOAK_URL=https://auth.tudominio.com/auth
   KEYCLOAK_REDIRECT_URI=https://auth.tudominio.com/api/auth/callback
   KEYCLOAK_POST_LOGOUT_REDIRECT_URI=https://auth.tudominio.com/
   VITE_KEYCLOAK_URL=https://auth.tudominio.com/auth
   ```

4. **Base ya creada:** Keycloak ignora el import del realm, así que los redirect URIs del
   cliente `optrax-frontend` siguen apuntando a la IP. Dos opciones:
   - Empezar limpio (sin datos que conservar): añade `-v` al `down` del paso 2.
   - Conservar datos: `OLD_HOST=<IP-vieja> sudo bash docker/fix-keycloak-hostname.sh` y, en la consola
     (`https://auth.tudominio.com/auth/admin/`), corregir *Valid redirect URIs* y *Web origins* de `optrax-frontend`.
5. **Levantar** (`-p auth-gateway` reutiliza el mismo volumen `pgdata`; sin `--project-directory`
   porque este compose usa rutas relativas a `docker/`):

   ```bash
   sudo docker compose -p auth-gateway --env-file .env -f docker/docker-compose.yml up -d --build
   ```

6. Comprobar: `curl -I https://auth.tudominio.com/api/health` y entrar a `https://auth.tudominio.com/`.

Con HTTPS real ya no hace falta el polyfill de `client/src/auth/subtle-polyfill.ts`
(solo actúa si el navegador no ofrece `crypto.subtle`).
