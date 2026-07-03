# Auth Manager — Panel de Administración de Keycloak

Panel de administración centralizado (BFF pattern) sobre la Admin REST API de Keycloak 24.0.3.
Gestiona usuarios, roles y aplicaciones (módulos) registrados en el realm `optrax-realm`.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Autenticación frontend | `react-oidc-context` + OIDC PKCE |
| Backend (BFF) | Node.js + Express + TypeScript |
| JWT Validation | `jose` + JWKS endpoint de Keycloak |
| Admin API | `axios` → Keycloak Admin REST API (service account) |
| Base de datos | PostgreSQL + Drizzle ORM |
| Identidad | Keycloak 24.0.3 |

---

## 1. Configuración manual de Keycloak

Accede a la consola de administración: `http://localhost:8080/admin` (usuario: `admin`, contraseña: `admin`).
Selecciona el realm **optrax-realm** (o créalo si no existe).

### 1.1 Client — `auth-manager-frontend` (para el navegador, PKCE)

1. **Clients → Create client**
   - Client type: `OpenID Connect`
   - Client ID: `auth-manager-frontend`
2. **Capability config**
   - Standard flow: ✅
   - Direct access grants: ❌
   - Client authentication: ❌ (cliente público)
3. **Access settings**
   - Valid redirect URIs: `http://localhost:3000/*`
   - Valid post logout redirect URIs: `http://localhost:3000/`
   - Web origins: `http://localhost:3000`
4. Guarda. No hay client secret (es público).

### 1.2 Client — `auth-manager` (para el backend, flujo legacy de sesión)

1. **Clients → Create client**
   - Client ID: `auth-manager`
2. **Capability config**
   - Standard flow: ✅
   - Client authentication: ✅ (confidencial)
3. **Access settings**
   - Valid redirect URIs: `http://localhost:3000/api/auth/callback`
   - Web origins: `http://localhost:3000`
4. En la pestaña **Credentials**, copia el **Client secret** → `KEYCLOAK_CLIENT_SECRET` en `.env`.

### 1.3 Client — `auth-manager-sa` (service account para Admin API)

1. **Clients → Create client**
   - Client ID: `auth-manager-sa`
2. **Capability config**
   - Client authentication: ✅
   - Service accounts roles: ✅
   - Desactiva Standard flow y Direct access grants
3. En la pestaña **Credentials**, copia el **Client secret** → `KEYCLOAK_SA_CLIENT_SECRET` en `.env`.
4. En la pestaña **Service account roles**, agrega los roles del cliente **realm-management**:
   - `manage-users`
   - `manage-clients`
   - `manage-realm`
   - `view-users`
   - `view-clients`
   - `view-realm`
   - `query-groups`
   - `query-users`
   - `query-clients`
   - `query-realms`

### 1.4 Roles del Realm — roles internos del panel

1. **Realm roles → Create role**
   - Nombre: `auth-manager-admin` — acceso completo al panel (escritura)
2. **Realm roles → Create role**
   - Nombre: `auth-manager-viewer` — solo lectura

### 1.5 Asignar roles a los administradores

Para cada usuario que deba acceder al panel:
1. **Users → {usuario} → Role mapping → Assign role**
2. Selecciona `auth-manager-admin` o `auth-manager-viewer`.

---

## 2. Variables de entorno

### Backend (`.env` en la raíz del monorepo)

Copia `.env.example` → `.env` y completa los valores:

```env
SESSION_SECRET=<genera con: openssl rand -hex 32>
KEYCLOAK_CLIENT_SECRET=<secret del client auth-manager>
KEYCLOAK_SA_CLIENT_SECRET=<secret del client auth-manager-sa>
```

### Frontend (`client/.env.local`)

Copia `client/.env.example` → `client/.env.local`:

```env
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=optrax-realm
VITE_KEYCLOAK_CLIENT_ID=auth-manager-frontend
VITE_ADMIN_ROLE=auth-manager-admin
VITE_VIEWER_ROLE=auth-manager-viewer
```

---

## 3. Instalación y desarrollo

### Con Docker (recomendado)

```bash
# Levanta Postgres + Keycloak
docker compose -f docker/docker-compose.yml up postgres keycloak -d

# Espera ~30s a que Keycloak inicie, luego levanta la app
docker compose -f docker/docker-compose.yml up app -d
```

La app estará en `http://localhost:3000`.

### Local (sin Docker)

Requiere PostgreSQL y Keycloak corriendo localmente.

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
cp client/.env.example client/.env.local
# Edita ambos archivos con tus valores

# Iniciar en modo desarrollo (backend + frontend con HMR)
npm run dev
```

---

## 4. Estructura del proyecto

```
auth-gateway/
├── server/src/
│   ├── config/env.ts                    # Validación Zod de variables de entorno
│   ├── services/keycloak-admin.service.ts  # Wrapper de la Admin REST API
│   ├── middleware/
│   │   ├── jwt-auth.ts                  # Validación JWT via JWKS + guards de roles
│   │   └── rate-limiter.ts              # Rate limiting por endpoint
│   ├── routes/
│   │   ├── dashboard.ts                 # GET /api/admin/dashboard
│   │   ├── users.ts                     # CRUD /api/admin/users
│   │   ├── roles.ts                     # CRUD /api/admin/roles
│   │   └── clients.ts                   # CRUD /api/admin/clients
│   ├── audit/audit.service.ts           # Registro de auditoría en PostgreSQL
│   ├── db/schema.ts                     # Tablas: users, audit_logs
│   └── auth/                            # Flujo legacy de sesión (se mantiene)
│
├── client/src/
│   ├── auth/
│   │   ├── oidc-config.ts              # Configuración react-oidc-context (PKCE)
│   │   └── useRoles.ts                 # Hook para roles del JWT
│   ├── api/admin-api.ts                # Cliente Axios con Bearer token
│   ├── pages/
│   │   ├── Dashboard.tsx               # Estadísticas y gráfica
│   │   ├── Users.tsx                   # Lista paginada con búsqueda
│   │   ├── UserDetail.tsx              # Edición, sesiones, asignación de roles
│   │   ├── Roles.tsx                   # CRUD de roles del realm
│   │   └── Modules.tsx                 # CRUD de clients + sus roles
│   └── components/
│       ├── Layout.tsx                  # Sidebar + topbar responsivo
│       ├── Table.tsx                   # Tabla paginada reutilizable
│       ├── ConfirmDialog.tsx           # Modal de confirmación
│       └── RoleDualList.tsx            # Dual-list para asignación de roles
│
└── docker/
    ├── docker-compose.yml
    └── Dockerfile
```

---

## 5. API del backend

Todas las rutas requieren `Authorization: Bearer <access_token>` del portal.

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/api/admin/dashboard` | admin, viewer | Estadísticas del realm |
| GET | `/api/admin/users` | admin, viewer | Lista paginada de usuarios |
| POST | `/api/admin/users` | admin | Crear usuario |
| GET | `/api/admin/users/:id` | admin, viewer | Detalle de usuario |
| PUT | `/api/admin/users/:id` | admin | Actualizar usuario |
| DELETE | `/api/admin/users/:id` | admin | Eliminar usuario |
| PUT | `/api/admin/users/:id/reset-password` | admin | Resetear contraseña |
| POST | `/api/admin/users/:id/verify-email` | admin | Verificar email |
| GET | `/api/admin/users/:id/sessions` | admin, viewer | Sesiones activas |
| DELETE | `/api/admin/users/:id/sessions` | admin | Revocar sesiones |
| GET | `/api/admin/users/:id/roles` | admin, viewer | Role mappings del usuario |
| POST | `/api/admin/users/:id/roles/realm` | admin | Asignar roles del realm |
| DELETE | `/api/admin/users/:id/roles/realm` | admin | Quitar roles del realm |
| POST | `/api/admin/users/:id/roles/clients/:clientUuid` | admin | Asignar roles de cliente |
| DELETE | `/api/admin/users/:id/roles/clients/:clientUuid` | admin | Quitar roles de cliente |
| GET | `/api/admin/roles` | admin, viewer | Lista roles del realm |
| POST | `/api/admin/roles` | admin | Crear rol del realm |
| PUT | `/api/admin/roles/:roleName` | admin | Actualizar rol |
| DELETE | `/api/admin/roles/:roleName` | admin | Eliminar rol |
| GET | `/api/admin/clients` | admin, viewer | Lista de clientes (módulos) |
| POST | `/api/admin/clients` | admin | Crear cliente |
| GET | `/api/admin/clients/:id` | admin, viewer | Detalle de cliente |
| PUT | `/api/admin/clients/:id` | admin | Actualizar cliente |
| GET | `/api/admin/clients/:id/roles` | admin, viewer | Roles del cliente |
| POST | `/api/admin/clients/:id/roles` | admin | Crear rol de cliente |
| PUT | `/api/admin/clients/:id/roles/:roleName` | admin | Actualizar rol de cliente |
| DELETE | `/api/admin/clients/:id/roles/:roleName` | admin | Eliminar rol de cliente |

---

## 6. Auditoría

Todas las operaciones de escritura quedan registradas en la tabla `audit_logs`:

```sql
SELECT actor_email, action, entity, entity_id, detail, timestamp
FROM audit_logs
ORDER BY timestamp DESC
LIMIT 50;
```
