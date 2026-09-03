# syntax=docker/dockerfile:1

# Se usa "slim" (Debian) y no "alpine" a propósito: el paquete "bcrypt" es
# un módulo nativo y en Alpine (musl libc) suele fallar al instalarse sin
# herramientas de compilación extra. "slim" evita ese problema por completo
# y sigue siendo una imagen razonablemente liviana.

# --- Etapa 1: dependencias -------------------------------------------------
# Se instalan una sola vez y se cachean mientras package*.json no cambie.
FROM node:22-slim AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
# --legacy-peer-deps: hay un conflicto de peer dependencies preexistente
# entre @nestjs/throttler y @nestjs/common que no afecta el funcionamiento
# real -- ver notas del proyecto.
RUN npm ci --legacy-peer-deps

# --- Etapa 2: build ---------------------------------------------------------
FROM node:22-slim AS build
WORKDIR /app
COPY --from=dependencias /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- Etapa 3: imagen final de producción -----------------------------------
# Solo dependencias de producción + el resultado ya compilado -- la imagen
# final no lleva el código fuente en TypeScript ni las devDependencies.
FROM node:22-slim AS produccion
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force
COPY --from=build /app/dist ./dist

# multer (subida de documentos) no crea la carpeta de destino sola -- tiene
# que existir de antemano, con permisos para el usuario "node" (ver más
# abajo). Si se usa docker-compose.yml, esta ruta queda montada como
# volumen para que los archivos sobrevivan a que se recree el contenedor.
RUN mkdir -p storage/documentos && chown -R node:node storage

# Usuario sin privilegios -- no correr la app como root dentro del contenedor.
USER node

EXPOSE 3000
CMD ["node", "dist/main.js"]
