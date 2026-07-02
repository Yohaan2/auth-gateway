# Auth Optrax - Keycloak Scaffold Full-Stack 🚀

Este es un **scaffold full-stack profesional** listo para producción que integra un módulo de autenticación federada con **Keycloak** usando el flujo seguro **Authorization Code Flow**. 

El proyecto está diseñado bajo un esquema de **monorepo** utilizando npm workspaces, comunicando fluidamente el frontend y el backend en desarrollo local y bajo contenedores Docker.

---

## 🛠️ Stack Tecnológico

*   **Backend:** Node.js + Express + TypeScript
*   **Frontend:** React + Vite + TypeScript
*   **Estilos:** Tailwind CSS + Lucide Icons
*   **Base de Datos:** PostgreSQL
*   **ORM:** Drizzle ORM + Drizzle Kit (migraciones y studio)
*   **Autenticación:** Keycloak (vía `openid-client` de OpenID Connect)
*   **Reverse Proxy:** Nginx
*   **Contenedores:** Docker + Docker Compose (Multi-stage builds)

---

## 📐 Arquitectura del Proyecto (Middleware Mode)

Una de las características más potentes de este scaffold es que **el backend de Express sirve el frontend de React usando Vite en modo desarrollo** (middleware mode) con soporte nativo para **HMR (Hot Module Replacement)** en un solo proceso. En producción, Express sirve directamente los archivos estáticos pre-compilados.

```
                  ┌─────────────────────────────────┐
                  │          Nginx (Proxy)          │
                  │            Port 80              │
                  └────────────────┬────────────────┘
                                   │
                     ┌─────────────┴─────────────┐
                     ▼                           ▼
        ┌─────────────────────────┐ ┌─────────────────────────┐
        │   Express App (Port 3000)│ │   Keycloak (Port 8080)  │
        │                         │ │                         │
        │  * /api/* ──► API       │ │  * Autenticación        │
        │  * / ─────► React Client│ │  * Registro/Roles       │
        │    (Vite Middleware Dev │ └─────────────────────────┘
        │     or Static Prod)     │
        └────────────┬────────────┘
                     │
                     ▼
        ┌─────────────────────────┐
        │  PostgreSQL (Port 5432) │
        │  * Tabla 'users'        │
        │  * Tabla 'session'      │
        └─────────────────────────┘
```

---

## 📂 Estructura de Directorios

El monorepo cuenta con la siguiente arquitectura limpia:

```
proyecto/
├── client/                      # React + Vite + Tailwind (Frontend)
│   ├── src/
│   │   ├── main.tsx             # Punto de entrada de React
│   │   ├── App.tsx              # Dashboard y Landing Page minimalista
│   │   ├── features/
│   │   │   └── auth/            # Contexto y hook `useAuth` de React
│   │   └── lib/
│   │       └── api.ts           # Cliente HTTP fetch wrapper para /api
│   ├── index.html
│   ├── vite.config.ts           # Configuración de Vite
│   ├── tailwind.config.ts       # Directivas de estilos
│   └── tsconfig.json
├── server/                      # Express + TypeScript (Backend)
│   ├── src/
│   │   ├── index.ts             # Entrypoint principal de Express
│   │   ├── vite.ts              # Integración de Vite en modo Middleware (Dev)
│   │   ├── static.ts            # Cargador de estáticos (Prod)
│   │   ├── config/
│   │   │   └── env.ts           # Validación estricta de variables con Zod
│   │   ├── auth/
│   │   │   ├── keycloak.ts      # Singleton del cliente openid-client
│   │   │   ├── middleware.ts    # Middlewares requireAuth y attachUser
│   │   │   └── routes.ts        # /login, /callback, /logout, /me
│   │   ├── db/
│   │   │   ├── client.ts        # Conexión Postgres y DB Healthcheck
│   │   │   └── schema.ts        # Esquema de la tabla 'users' en Drizzle
│   │   └── middlewares/
│   │       ├── errorHandler.ts  # Manejador centralizado de errores
│   │       └── logger.ts        # Logger estructurado de Pino
│   ├── tsconfig.json
│   └── package.json
├── nginx/
│   └── default.conf             # Configuración del proxy inverso Nginx
├── docker/
│   ├── Dockerfile               # Compilación multi-stage de producción
│   ├── docker-compose.yml       # Orquestador de servicios del stack
│   └── keycloak-realm-export.json # Realm auto-importable de Keycloak
├── .env.example                 # Plantilla de configuración
├── .env                         # Variables de entorno activas
├── package.json                 # Workspaces y scripts raíz
└── README.md
```

---

## 🚀 Cómo arrancar el proyecto

### Opción A: Levantar TODO el stack con Docker en 1 solo comando (Recomendado)

Esta opción levantará **Nginx, Keycloak (con el Realm y usuarios pre-configurados), PostgreSQL y la App compilada en producción** de forma automática.

1.  Asegúrate de estar en el directorio raíz del proyecto.
2.  Inicia Docker Compose:
    ```bash
    docker compose -f docker/docker-compose.yml up --build
    ```
3.  **¡Listo!** Abre tu navegador e ingresa a:
    *   **Aplicación principal (a través de Nginx):** `http://localhost`
    *   **Consola de Administración de Keycloak:** `http://localhost:8080` (Usuario: `admin` / Contraseña: `admin`)

#### 👥 Usuarios de prueba pre-configurados en Keycloak:
Para facilitar el testeo inmediato, el Realm importado ya cuenta con dos usuarios creados:
*   **Usuario de Prueba:**
    *   **Email:** `usuario@optrax.com`
    *   **Contraseña:** `user123`
*   **Administrador de Prueba:**
    *   **Email:** `admin@optrax.com`
    *   **Contraseña:** `admin123`

---

### Opción B: Ejecutar en Desarrollo Local (Vite Middleware)

Si prefieres ejecutar el código directamente en tu máquina local para programar con recarga rápida (HMR).

#### Paso 1: Levantar servicios de Infraestructura (Base de datos y Keycloak)
Para que la app funcione localmente, necesitamos la base de datos de PostgreSQL y Keycloak encendidos.
```bash
# Encender solo PostgreSQL y Keycloak
docker compose -f docker/docker-compose.yml up postgres keycloak -d
```

#### Paso 2: Configurar variables de entorno
Copia la plantilla `.env.example` en un archivo llamado `.env` en la raíz del monorepo (este archivo ya está auto-configurado con los valores por defecto):
```bash
cp .env.example .env
```

#### Paso 3: Instalar dependencias del monorepo
Instala todos los paquetes del cliente y servidor de una sola vez desde la raíz:
```bash
npm install
```

#### Paso 4: Sincronizar el esquema de PostgreSQL usando Drizzle ORM
Aplica la estructura de datos (tabla de usuarios) a la base de datos de desarrollo usando Drizzle Kit:
```bash
# Ejecutar desde la raíz para empujar los esquemas a Postgres
npm run db:push --workspace=server
```

#### Paso 5: Iniciar el entorno de desarrollo
Inicia el servidor backend de Express, el cual levantará dinámicamente a Vite en modo middleware:
```bash
npm run dev
```

Abre tu navegador e ingresa a `http://localhost:3000`. Cualquier cambio en el frontend o backend se reflejará instantáneamente en caliente.

---

## 🔒 Lógica Detrás de la Autenticación con Keycloak

1.  **Redirección (`/api/auth/login`):** La app genera un `state` y `nonce` temporal que guarda en la sesión segura de Express, y redirige al navegador del cliente al portal oficial de Keycloak.
2.  **Consentimiento e Intercambio (`/api/auth/callback`):** Al iniciar sesión con éxito, Keycloak devuelve un `code` temporal al callback. El backend de Express intercepta este código y, haciendo uso de `openid-client`, lo intercambia por tokens de acceso (`access_token`, `id_token` y `refresh_token`) internamente.
3.  **Lazy Provisioning (Sincronización de Base de Datos):** Una vez validados los tokens, el backend consulta el perfil del usuario en Keycloak (claim `sub`). Si es la primera vez que inicia sesión, crea de forma automática un usuario asociado en la tabla de PostgreSQL (`users`). Si ya existía, actualiza su nombre u otros datos si hubieran cambiado.
4.  **Manejo de Sesión:** Los tokens se almacenan de manera segura en el backend (`express-session`). Para desarrollo se utiliza un almacén en memoria (`MemoryStore`), mientras que para producción ya está lista y configurada la persistencia segura usando la base de datos de PostgreSQL a través de `connect-pg-simple` (se auto-crea la tabla `session`).
5.  **Cierre de Sesión (`/api/auth/logout`):** Destruye de forma segura la sesión en Express y redirige a Keycloak para invalidar su sesión de Single Sign-On (SSO).

---

## 💾 Comandos Útiles de Drizzle

Si deseas explorar y gestionar la base de datos PostgreSQL de manera gráfica durante el desarrollo:

*   **Ver la Base de Datos Gráficamente (Drizzle Studio):**
    ```bash
    npm run db:studio --workspace=server
    ```
    Esto abrirá un panel de control en tu navegador en `https://local.drizzle.studio` para visualizar y editar tablas manualmente.
*   **Generar Archivos de Migraciones SQL:**
    ```bash
    npm run db:generate --workspace=server
    ```
