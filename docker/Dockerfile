# ==========================================
# STAGE 1: Instalar dependencias
# ==========================================
FROM node:22-alpine AS deps
WORKDIR /app

# Copiar archivos de definición de paquetes para el monorepo y workspaces
COPY package.json ./
COPY package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

# Instalar dependencias de producción y desarrollo de todo el monorepo
RUN npm ci

# ==========================================
# STAGE 2: Construir aplicación (client & server)
# ==========================================
FROM node:22-alpine AS build
WORKDIR /app

# Copiar dependencias instaladas y archivos fuentes
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY client ./client
COPY server ./server

# Compilar frontend (Vite build -> client/dist)
ARG VITE_KEYCLOAK_URL
ARG VITE_KEYCLOAK_REALM
ARG VITE_KEYCLOAK_CLIENT_ID
ARG VITE_ADMIN_ROLE
ARG VITE_VIEWER_ROLE
ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL \
    VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM \
    VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID \
    VITE_ADMIN_ROLE=$VITE_ADMIN_ROLE \
    VITE_VIEWER_ROLE=$VITE_VIEWER_ROLE
RUN test -n "$VITE_KEYCLOAK_URL" && test -n "$VITE_KEYCLOAK_REALM" && test -n "$VITE_KEYCLOAK_CLIENT_ID"
RUN npm run build --workspace=client

# Compilar backend (TypeScript build -> server/dist)
RUN npm run build --workspace=server

# Integración crítica: Copiar el build estático de React a la carpeta public de Express
RUN mkdir -p /app/server/public && cp -r /app/client/dist/* /app/server/public/

# ==========================================
# STAGE 3: Runtime de producción liviano
# ==========================================
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copiar archivos necesarios para ejecutar el servidor compilado
COPY package.json ./
COPY package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/public ./server/public

# Instalar SOLO dependencias de producción para el backend en la imagen final
# para mantenerla con el menor peso posible
RUN npm ci --omit=dev --workspace=server
WORKDIR /app/server

# Exponer el puerto del servidor Express
EXPOSE 3000

# Comando para arrancar en producción
CMD ["npm", "run", "start"]
