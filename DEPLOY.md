# Preparar JAYM LEGAL para producción

Esta guía es independiente del proveedor de hosting -- describe qué necesita
el sistema para correr en cualquier lado, y al final da una recomendación
concreta para el caso de este despacho.

## Qué se agregó

- **Migraciones de base de datos** (`src/migrations/`): antes, `synchronize`
  creaba/ajustaba las tablas automáticamente a partir de las entidades --
  cómodo en desarrollo, pero riesgoso en producción (un cambio de columna
  podría perder datos sin aviso ni registro). Ahora existe una migración
  inicial (`InicialEsquemaCompleto`) que crea el esquema completo de forma
  explícita y reversible. En producción (`NODE_ENV=production`),
  `synchronize` se apaga solo y las migraciones pendientes se aplican
  automáticamente al arrancar (`migrationsRun: true` en `app.module.ts`) --
  no hace falta un paso manual aparte.

  Cuando en el futuro se agregue o cambie una entidad, el flujo es:
  ```bash
  npm run migration:generate -- src/migrations/NombreDelCambio
  git add src/migrations/
  git commit
  ```
  Eso genera un archivo nuevo con el SQL exacto del cambio, revisable antes
  de aplicarlo. `npm run migration:run` lo aplica a mano si se quiere probar
  antes del arranque automático; `npm run migration:revert` deshace la
  última.

- **Dockerfile**: build de 3 etapas (dependencias -> compilar -> imagen
  final solo con lo necesario para correr). Usa `node:22-slim` (no
  `alpine`) a propósito -- `bcrypt` es un módulo nativo que en Alpine suele
  fallar al instalar sin herramientas de compilación extra.

- **docker-compose.yml**: referencia para correr backend + Postgres juntos
  con un solo comando, útil para un servidor propio (VPS) o para probar el
  build de producción en la máquina local. Es opcional -- con un Postgres
  administrado (Neon, Render, Supabase) solo hace falta la imagen del
  Dockerfile, sin este archivo.

## Dos formas de desplegar el backend

**A) Con Docker** (`Dockerfile` + opcionalmente `docker-compose.yml`) --
para un VPS propio (DigitalOcean, Hetzner, etc.) o cualquier plataforma que
acepte una imagen Docker (Railway, Fly.io, Render, AWS, ...).

**B) Sin Docker, con un "buildpack" de Node** -- para plataformas que
compilan directo desde el código (Render, Railway, etc.):
- Comando de build: `npm ci --legacy-peer-deps && npm run build`
- Comando de arranque: `node dist/main.js`
- Node 22.

Ambas formas terminan corriendo exactamente el mismo `dist/main.js` -- la
diferencia es solo quién arma el contenedor.

## Variables de entorno necesarias en producción

Todas están documentadas con instrucciones paso a paso en `.env.example`.
Como mínimo para arrancar: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`
(el dominio real del frontend, para que CORS lo permita) y `NODE_ENV=production`.
El resto (HubSpot, Google Calendar, el asistente de IA, las alertas por
correo) son integraciones opcionales -- si se dejan vacías, esa función
específica simplemente no hace nada, sin romper el resto del sistema.

## El almacenamiento de documentos

Los documentos subidos (`storage/documentos/`) se guardan en disco, no en
la base de datos. Esto es importante en producción: si el servidor se
recrea (redeploy, reinicio de contenedor), esa carpeta debe persistir --
con Docker, como un volumen (ya está resuelto en `docker-compose.yml`); en
una plataforma sin volúmenes persistentes (la mayoría de los "serverless"),
hay que migrar el almacenamiento a algo externo (S3 o similar) antes de
lanzar -- no está hecho todavía, y es la única pieza de este punto #03 que
de verdad depende de qué proveedor se elija.

## Recomendación para este despacho

**Render**, para backend y frontend juntos, más **Neon** (Postgres
administrado) para la base de datos -- el código ya lo anticipa: la
detección automática de SSL en `app.module.ts` y en `data-source.ts` ya
reconoce URLs de Neon, Supabase y Render sin configuración extra.

Por qué esta combinación y no otra, para un despacho de este tamaño sin
personal de IT dedicado:

- **Render** despliega directo desde el repositorio de Git (push a `main`
  y listo, sin tocar Docker a mano) y cubre las tres piezas del sistema:
  el backend como "Web Service" (opción B de arriba, sin Docker),
  el frontend como "Static Site" (el build de Vite), y certificados HTTPS
  automáticos -- todo en un solo dashboard y una sola factura.
- **Neon** dentro del mismo flujo: capa gratuita generosa para el volumen
  de datos de un despacho pequeño, backups automáticos, y — a diferencia de
  Postgres en el propio Render — separa el ciclo de vida de la base de
  datos del backend, así que un redeploy del backend nunca arriesga la base
  de datos.
- El único punto pendiente antes de lanzar con esta combinación: mover
  `storage/documentos/` a S3 (o el almacenamiento de objetos de Render),
  porque los "Web Services" de Render no garantizan disco persistente entre
  despliegues. Si se prefiere evitar ese paso por ahora, la alternativa es
  un VPS propio con `docker-compose.yml` tal cual está aquí (Postgres +
  backend + volumen persistente) -- más barato y con el almacenamiento
  local ya resuelto, a cambio de tener que mantener el servidor uno mismo.

Si se quiere, el siguiente paso concreto sería armar esa migración del
almacenamiento a S3 (o decidir ir por el VPS) -- decisión que conviene
tomar antes de apuntar el dominio real, no después.
