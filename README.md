# JAYM LEGAL — Backend (Bloque 1 del MVP)

API en **NestJS + TypeORM + PostgreSQL** para JAYM LEGAL MULTISERVICES S.R.L.

Módulos incluidos en esta entrega:

- **Clientes**: alta de personas físicas y jurídicas con detección
  automática de duplicados (cédula, pasaporte, RNC o correo), reforzada
  mediante índices únicos parciales a nivel de base de datos.
- **Expedientes**: creación con código automático
  `JAYM-{año}-{materia}-{secuencial}` (ej. `JAYM-2026-CIV-0001`).
- **Historial de expediente**: append-only. Cada `PATCH` a un expediente
  captura el estado anterior y el nuevo dentro de una misma transacción —
  nunca se actualiza un expediente sin dejar rastro. Incluye un endpoint de
  restauración de versiones anteriores, restringido al rol
  Superadministrador.

Este flujo fue probado de extremo a extremo contra una instancia real de
PostgreSQL 16: creación de cliente, detección de duplicado, creación de
expediente, actualización con captura automática de historial.

## Requisitos

- Node.js 20 o superior
- PostgreSQL 14 o superior

## Instalación

```bash
npm install
cp .env.example .env
# Editar .env con la cadena de conexión real a PostgreSQL
npm run start:dev
```

En desarrollo, `synchronize: true` crea las tablas automáticamente a partir
de las entidades (ver `src/app.module.ts`). **Antes de pasar a producción**,
generar migraciones formales de TypeORM y desactivar `synchronize`.

## Endpoints disponibles

### Clientes

- `GET /clientes?q=&tipo=` — busca por nombre, cédula, pasaporte, RNC o
  correo; `tipo` filtra por `fisico` o `juridico`.
- `GET /clientes/:id`
- `POST /clientes` — si detecta un posible duplicado, responde
  `{ duplicados: [...] }` en vez de crear el registro. Para crear de todos
  modos, reenviar la misma solicitud a `POST /clientes?forzar=true`.

### Expedientes

- `GET /expedientes?estado=&materia=&clienteId=`
- `GET /expedientes/:id`
- `POST /expedientes` — requiere el header `x-usuario-id`
- `PATCH /expedientes/:id` — requiere el header `x-usuario-id`; dispara
  automáticamente el registro de historial dentro de la misma transacción
- `POST /expedientes/:id/restaurar/:historialId` — requiere los headers
  `x-usuario-id` y `x-usuario-rol: superadministrador`

### Historial

- `GET /expedientes/:expedienteId/historial`

## Autenticación en los endpoints de Clientes y Expedientes

Todos los endpoints de estos dos módulos requieren un JWT válido (ver
sección de Usuarios y Autenticación más abajo). El usuario que crea o
modifica un registro se identifica automáticamente a partir del token —
ya no es necesario ni posible enviarlo manualmente por header.

## Estructura del proyecto

```
src/
  clientes/       Entidad, DTO, servicio y controlador de Clientes
  expedientes/     Entidad, DTO, servicio y controlador de Expedientes
  historial/       Entidad y servicio append-only de Historial
  usuarios/        Entidad, DTO, servicio y controlador de Usuarios internos
  auth/            Login, JWT, guards, decoradores y 2FA
  documentos/      Entidad, DTO, servicio y controlador de Documentos
  requisitos/      Plantillas configurables y checklist por expediente
  agenda/          Eventos de calendario (audiencias, citas, plazos, etc.)
  alertas/         Motor de reglas: genera y auto-resuelve alertas por cron
  common/enums/    Enums compartidos (materias, estados, roles, etc.)
  app.module.ts    Conexión a PostgreSQL, guard global y registro de módulos
  main.ts          Arranque, validación global y CORS
storage/
  documentos/      Archivos subidos (solo desarrollo local, ver .gitignore)
```

## Próximos módulos (en el orden ya aprobado)

1. ~~Usuarios y autenticación (roles, JWT, 2FA)~~ — completado, ver abajo
2. ~~Documentos (subida, versiones, papelera recuperable)~~ — completado, ver abajo
3. ~~Requisitos pendientes (checklist configurable por materia)~~ — completado, ver abajo
4. ~~Agenda y Alertas~~ — completado, ver abajo
5. Frontend (React + Tailwind) consumiendo esta API — único módulo pendiente

## Módulo de Agenda

- `GET/POST /agenda`, `GET/PATCH /agenda/:id` — audiencias, citas,
  reuniones, depósitos, seguimientos, vencimientos, llamadas, tareas
  internas y plazos judiciales (sección 9). Filtrable por expediente,
  responsable, rango de fechas y estado — la base de las vistas de
  calendario diario/semanal/mensual.
- Si no se especifica `responsableId` al crear, se asigna automáticamente
  a quien lo crea.

## Módulo de Alertas

Motor de reglas que **lee** datos que ya existen (expedientes, documentos,
requisitos, agenda) y genera o resuelve alertas automáticamente — nunca se
crean alertas manualmente desde la interfaz (sección 14).

- **Reglas implementadas**: expediente sin movimiento, plazo próximo,
  plazo vencido, documento vencido, requisito obligatorio pendiente
  vencido, evento de agenda próximo, evento de agenda vencido.
- **Configuración por regla** (`GET /alertas/config`,
  `PATCH /alertas/config/:tipoRegla`, restringido a
  `superadministrador`/`abogado_administrador`): permite ajustar el umbral
  en días y la severidad por defecto sin tocar código. Se siembra con
  valores por defecto la primera vez que arranca el sistema.
- **Ejecución automática**: `AlertasScheduler` corre el motor cada hora
  vía `@nestjs/schedule`. También puede dispararse manualmente con
  `POST /alertas/generar` (útil para pruebas o un botón de "actualizar
  ahora" en el dashboard).
- **Auto-resolución**: cada ejecución compara las alertas abiertas contra
  las condiciones actuales — si una condición deja de cumplirse (ej. se
  corrige un plazo vencido), la alerta se marca `resuelta` automáticamente
  sin necesidad de que un usuario la cierre a mano, conservando el
  historial de que existió.
- `GET /alertas?resuelta=&severidad=&expedienteId=` y
  `PATCH /alertas/:id/vista` para marcarla como vista.

Este módulo fue probado de extremo a extremo: creación de un expediente
con plazo vencido, un evento de agenda vencido y un documento vencido →
el motor generó las 3 alertas con la severidad correcta; al corregir el
plazo, la alerta correspondiente se autorresolvió en la siguiente
ejecución, quedando registrada como resuelta sin perder su historial.

## Módulo de Requisitos pendientes

- **Plantillas configurables**: `GET/POST /requisitos-plantilla` — el
  checklist base por materia jurídica. Crear y desactivar plantillas está
  restringido a `superadministrador` y `abogado_administrador`. Desactivar
  nunca borra la plantilla (los expedientes ya creados conservan su copia
  del requisito, sin verse afectados por cambios posteriores).
- **Generación automática**: al crear un expediente
  (`POST /expedientes`), el sistema copia automáticamente las plantillas
  activas de esa materia a `expediente_requisitos`, ya con estado
  `pendiente`. Si no hay plantillas configuradas para la materia, el
  expediente simplemente queda con checklist vacío (no bloquea la
  creación).
- **Checklist por expediente**:
  `GET /expedientes/:id/requisitos` (listar),
  `POST /expedientes/:id/requisitos` (agregar un requisito manual único),
  `PATCH /expedientes/:id/requisitos/:requisitoId` (actualizar estado,
  responsable, documento vinculado, observaciones).
- **Progreso**: `GET /expedientes/:id/requisitos/progreso` calcula al
  vuelo `(obligatorios completos o no_aplica) / total obligatorios × 100`
  — nunca se almacena como campo fijo.
- **Advertencia no bloqueante de depósito**: si se actualiza un expediente
  a `estado: "listo_para_depositar"` y quedan requisitos obligatorios
  pendientes, la respuesta de `PATCH /expedientes/:id` incluye
  `advertenciaDeposito` con la lista de pendientes — el cambio de estado
  igual se aplica, la decisión final es del abogado, tal como exige la
  sección 8 del requerimiento original.

Este módulo fue probado de extremo a extremo: creación de plantillas,
generación automática del checklist al abrir un expediente, cálculo de
progreso (0% → 100%), y el ciclo completo de advertencia de depósito
(aparece con pendientes, desaparece al completarlos).

## Módulo de Documentos

- **Subida** (`POST /documentos`, multipart, campo `archivo`): guarda el
  archivo en `./storage/documentos` con un nombre físico único (UUID) para
  evitar colisiones. En producción, `rutaAlmacenamiento` pasa a contener la
  key de un objeto S3/GCS en vez de una ruta de disco local (ver
  arquitectura recomendada en el documento de planificación).
- **Versionado**: `POST /documentos/:id/nueva-version` no sobrescribe la
  versión anterior — crea una fila nueva encadenada por `documentoPadreId`.
  `GET /documentos` lista solo la versión vigente de cada documento;
  `GET /documentos/:id/versiones` devuelve la cadena completa.
- **Descarga**: `GET /documentos/:id/descargar` transmite el archivo con su
  nombre original, respetando el control de confidencialidad.
- **Confidencialidad**: un documento con `confidencial: true` solo es
  visible/descargable por los roles en
  `ROLES_CON_ACCESO_CONFIDENCIAL_POR_DEFECTO` (Superadministrador, Abogado
  administrador) o por roles con un permiso explícito en
  `documento_permisos`. Cualquier otro rol recibe 403.
- **Papelera recuperable**: `DELETE /documentos/:id` solo marca
  `eliminadoEn` — nunca borra el archivo físico ni la fila.
  `POST /documentos/:id/restaurar` la revierte. La purga definitiva
  (`DELETE /documentos/:id/purgar`) sí borra el archivo y la fila, y está
  restringida al rol `superadministrador`.
- **Límite de tamaño**: 25 MB por archivo en este MVP (ajustable en
  `documentos.controller.ts`).

Este módulo fue probado de extremo a extremo: subida real, nueva versión,
listado correcto (solo vigente vs. cadena completa), descarga con contenido
verificado, bloqueo 403 de un documento confidencial para un rol sin
permiso, y el ciclo completo de papelera → restaurar.

## Módulo de Usuarios y Autenticación

- **JWT global**: todo endpoint exige un token válido
  (`Authorization: Bearer <token>`) salvo los marcados con `@Public()`.
- **Bootstrap de un solo uso**: `POST /auth/registro-inicial` crea el primer
  Superadministrador. Deja de funcionar en cuanto existe al menos un usuario
  en el sistema — a partir de ahí, usar `POST /usuarios` con una sesión de
  Superadministrador.
- **Login**: `POST /auth/login` — responde `{ accessToken, usuario }`, o
  `{ requiereDosFactor: true }` si el usuario tiene 2FA activo y no envió
  `codigoDosFactor` en el cuerpo de la solicitud.
- **Gestión de usuarios**: `GET/POST /usuarios` y `PATCH /usuarios/:id/estado`
  — restringidos al rol `superadministrador` mediante `RolesGuard`.
- **2FA (TOTP)**: `POST /auth/2fa/iniciar` (requiere sesión) genera el
  secreto y una URL `otpauth://` para escanear con Google Authenticator o
  similar; `POST /auth/2fa/confirmar` activa el 2FA tras validar el primer
  código real generado por la app autenticadora.

Este flujo se probó de extremo a extremo: bootstrap del primer usuario,
bloqueo sin token (401), bloqueo por rol insuficiente (403), y activación
más verificación completa de 2FA con códigos TOTP reales generados por
`otplib`.

Los controladores de **Clientes** y **Expedientes** ya no usan el header
temporal `x-usuario-id` — el usuario autenticado se extrae directamente del
JWT mediante el decorador `@CurrentUser('sub')`.
