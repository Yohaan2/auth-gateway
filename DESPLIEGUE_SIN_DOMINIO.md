# Despliegue sin dominio (solo IP, HTTP)

Para un servidor sin DNS ni certificados TLS. Es un **override** de `docker/docker-compose.yml`
(el stack con dominio + HTTPS): solo cambia lo mínimo, el resto es la misma definición.

| Modo | Archivos | Cómo entras |
|------|----------|-------------|
| **Servidor por IP** | `docker/docker-compose.yml` + `docker/docker-compose.no-domain.yml` + `nginx/default.no-domain.conf` | `http://<IP>/` |
| **Dominio + HTTPS** | `docker/docker-compose.yml` + `nginx/default.conf` | `https://<dominio>/` |
| **Local** | `docker-compose.local.yml` | `http://127.0.0.1:19080` |

El override publica `80:80` en todas las interfaces; Nginx sirve la app en `/` y Keycloak en `/auth/`.
Usa la **IP que ven los clientes**, no `localhost` (ojo: la IP del iBMC no es la del servidor).

## 1. `.env` (sustituye `203.0.113.10` por la IP)

```dotenv
NODE_ENV=production
APP_URL=http://203.0.113.10
FRONTEND_URL=http://203.0.113.10
KEYCLOAK_URL=http://203.0.113.10/auth
KEYCLOAK_INTERNAL_URL=http://keycloak:8080/auth
KEYCLOAK_REDIRECT_URI=http://203.0.113.10/api/auth/callback
KEYCLOAK_POST_LOGOUT_REDIRECT_URI=http://203.0.113.10/
VITE_KEYCLOAK_URL=http://203.0.113.10/auth
```

Sin `:8000` ni `:3000`. Secretos de cliente y `SESSION_SECRET` con 32+ caracteres; contraseñas con `@` en
`DATABASE_URL`/`DATA_SOURCE_NAME` como `%40`. Admin master de Keycloak: `KC_BOOTSTRAP_ADMIN_USERNAME` y
`KC_BOOTSTRAP_ADMIN_PASSWORD`. Resto de variables igual que en `DESPLIEGUE_PRODUCCION.md`.
`FRONTEND_URL` debe coincidir con `APP_URL`. Si existe un `docker/.env` antiguo, bórralo.

## 2. Levantar

Siempre desde la raíz del repo, en **una sola línea**. `-p auth-gateway` mantiene el volumen `pgdata`.

```bash
sudo docker compose -p auth-gateway --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.no-domain.yml up -d --build
```

El servicio `realm-prepare` genera `docker/generated/realm.json` desde `.env` antes de Keycloak.

Comprobar (`KC_HOSTNAME` debe ser tu `KEYCLOAK_URL`):

```bash
sudo docker exec auth-optrax-keycloak printenv KC_HOSTNAME KC_HTTP_RELATIVE_PATH
curl -sI http://<IP>/auth/admin/ | grep -E '^(HTTP|Location:)'
```

Empezar de cero (**borra la base**): añade `down -v` antes del `up`.
Si fallan nombres de contenedor `auth-optrax-*` ya existentes: `sudo docker rm -f` de ese contenedor.

## 3. Primer acceso

| Qué | URL |
|-----|-----|
| **Consola Keycloak** (master: `KC_BOOTSTRAP_*`) | `http://<IP>/auth/admin/` |
| **Auth Manager** (usuario de `optrax-realm` con rol `SUPER_ADMIN`) | `http://<IP>/` |

Crea el usuario del panel en `optrax-realm` (contraseña no temporal, rol `SUPER_ADMIN`).
`/admin/` (sin `/auth`) cae en la SPA: nginx lo redirige a `/auth/admin/`.

Login por HTTP: los navegadores no exponen `crypto.subtle` fuera de HTTPS/localhost; el cliente incluye un
polyfill de SHA-256 (`client/src/auth/subtle-polyfill.ts`) que solo actúa en ese caso.

## 4. Problemas conocidos

- **Redirige a otra IP** (p. ej. `10.0.10.16`, el iBMC): Keycloak guarda `frontend_url` en Postgres y no se
  reimporta el realm. Ejecuta `sudo bash docker/fix-keycloak-hostname.sh` (solo modo HTTP: pone
  `ssl_required=NONE`), recrea `keycloak` con el comando de arriba y `sudo docker restart auth-optrax-nginx`.
- **`ERR_TOO_MANY_REDIRECTS`:** escribe `http://` a mano, ventana privada y borra cookies del sitio. Si persiste,
  mira el `Location` del `curl` anterior: no debe repetirse la misma URL.
- **502 tras recrear Keycloak:** `sudo docker restart auth-optrax-nginx`.
- Nunca pongas URI en un `proxy_pass` con variable (`proxy_pass http://$var:8080/auth/;`): nginx reescribe toda
  ruta a `/auth/`. Ya está corregido en `nginx/*.conf`.

## 5. Limitaciones

- Todo va en **HTTP**: no exponer a Internet abierto sin otra capa de seguridad.
- Si cambias la IP, actualiza `.env`, **reconstruye** `app` (`VITE_*` se incrustan en el build) y revisa los redirect
  URIs del cliente `optrax-frontend` (el import del realm solo ocurre con base nueva).

## 6. Migrar a dominio + HTTPS (preparado, NO activo)

El dominio sale de `DOMAIN` y `KEYCLOAK_URL` del `.env`; nada está escrito a mano en los archivos.

1. **DNS:** registro A de `auth.tudominio.com` → IP del servidor. Abre 80 y 443.
2. **Certificado** (con el stack parado para liberar el puerto 80):

   ```bash
   sudo docker compose -p auth-gateway --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.no-domain.yml down
   sudo certbot certonly --standalone -d auth.tudominio.com
   sudo cp /etc/letsencrypt/live/auth.tudominio.com/fullchain.pem docker/certs/fullchain.pem
   sudo cp /etc/letsencrypt/live/auth.tudominio.com/privkey.pem docker/certs/privkey.pem
   ```

   Renovación (~60 días): `certbot renew`, repetir la copia y `docker restart auth-optrax-nginx`.
   Con CA interna basta con dejar los `.pem` en `docker/certs/`.
3. **`.env`:** el dominio y todas las URLs en `https://`:

   ```dotenv
   DOMAIN=auth.tudominio.com
   APP_URL=https://auth.tudominio.com
   FRONTEND_URL=https://auth.tudominio.com
   KEYCLOAK_URL=https://auth.tudominio.com/auth
   KEYCLOAK_REDIRECT_URI=https://auth.tudominio.com/api/auth/callback
   KEYCLOAK_POST_LOGOUT_REDIRECT_URI=https://auth.tudominio.com/
   VITE_KEYCLOAK_URL=https://auth.tudominio.com/auth
   ```

4. **Base ya creada:** el realm no se reimporta, así que los redirect URIs de `optrax-frontend` siguen con la IP.
   O empiezas limpio (`down -v` en el paso 2), o conservas datos: corrige *Valid redirect URIs* y *Web origins* de
   `optrax-frontend` en la consola. **No** ejecutes `fix-keycloak-hostname.sh` en HTTPS.
5. **Levantar** (solo el compose base, sin override):

   ```bash
   sudo docker compose -p auth-gateway --env-file .env -f docker/docker-compose.yml up -d --build
   ```

6. Comprobar: `curl -I https://auth.tudominio.com/api/health` y entrar a `https://auth.tudominio.com/`.
