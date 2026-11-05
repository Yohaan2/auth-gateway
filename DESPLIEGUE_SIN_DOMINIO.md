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

## 2. Realm y build

```bash
node docker/prepare-realm.cjs .env
docker compose -f docker/docker-compose.no-domain.yml build app
docker compose -f docker/docker-compose.no-domain.yml up -d
```

## 3. Nginx usado

Archivo **`nginx/default.no-domain.conf`** (no `default.conf`, que asume HTTPS y
certificados en `docker/certs/`).

## 4. Limitaciones

- Todo el tráfico va en **HTTP**; no usar en Internet abierto sin otra capa de seguridad.
- Los redirect URIs de los clientes Keycloak deben coincidir con `APP_URL` y rutas OIDC.
- Si cambias la IP o el puerto, actualiza `.env`, regenera el realm si aplica y **reconstruye** la imagen `app` (`VITE_*`).
