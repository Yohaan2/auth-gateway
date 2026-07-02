# ==========================================
# STAGE 1: Instalar dependencias
# ==========================================
FROM node:20-alpine AS deps
WORKDIR /app

# Copiar archivos de definición de paquetes para el monorepo y workspaces
COPY package.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

# Instalar dependencias de producción y desarrollo de todo el monorepo
RUN npm install

# ==========================================
# STAGE 2: Construir aplicación (client & server)
# ==========================================
FROM node:20-alpine AS build
WORKDIR /app

# Copiar dependencias instaladas y archivos fuentes
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/client/node_modules ./client/node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY package.json ./
COPY client ./client
COPY server ./server

# Compilar frontend (Vite build -> client/dist)
RUN npm run build --workspace=client

# Compilar backend (TypeScript build -> server/dist)
RUN npm run build --workspace=server

# Integración crítica: Copiar el build estático de React a la carpeta public de Express
RUN mkdir -p /app/server/public && cp -r /app/client/dist/* /app/server/public/

# ==========================================
# STAGE 3: Runtime de producción liviano
# ==========================================
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copiar archivos necesarios para ejecutar el servidor compilado
COPY package.json ./
COPY server/package.json ./server/
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/public ./server/public

# Instalar SOLO dependencias de producción para el backend en la imagen final
# para mantenerla con el menor peso posible
WORKDIR /app/server
RUN npm install --only=production

# Exponer el puerto del servidor Express
EXPOSE 3000

# Comando para arrancar en producción
CMD ["npm", "run", "start"]
