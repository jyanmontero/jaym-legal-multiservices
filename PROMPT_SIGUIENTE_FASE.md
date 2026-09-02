# Prompt: Completar JAYM Legal (Frontend + puesta en producción)

> Copia y pega este documento completo al inicio de una conversación con un desarrollador o con una herramienta de IA para programar (Claude Code, Cursor, etc.) para que continúe el proyecto.

## Contexto del proyecto

JAYM Legal Multiservices es una firma legal en La Romana, República Dominicana (RNC 133540772). Se está construyendo un sistema interno de gestión de casos ("Bloque 1 del MVP" ya completado) para reemplazar el manejo manual de clientes, expedientes, documentos y plazos judiciales.

El backend ya existe y está probado de extremo a extremo. Repositorio local: `jaym-legal-backend` (NestJS + TypeORM + PostgreSQL). **No hay que reconstruirlo** — la tarea es completar lo que falta para que el equipo de la firma pueda usarlo de verdad.

## Lo que ya existe (backend completo, no modificar su lógica salvo que se indique)

- **Clientes**: alta de personas físicas y jurídicas, detección automática de duplicados (cédula, pasaporte, RNC o correo).
- **Expedientes**: código automático `JAYM-{año}-{materia}-{secuencial}`, historial append-only de cada cambio (nunca se pierde el estado anterior), restauración de versiones (solo Superadministrador).
- **Documentos**: subida con versionado (nunca sobrescribe), papelera recuperable, control de confidencialidad por rol, descarga.
- **Requisitos pendientes**: checklist configurable por materia jurídica, se genera automático al abrir un expediente, cálculo de progreso, advertencia no bloqueante al depositar con pendientes.
- **Agenda**: audiencias, citas, plazos judiciales, vencimientos — filtrable por expediente/responsable/fecha/estado.
- **Alertas**: motor de reglas automático (plazos próximos/vencidos, documentos vencidos, etc.), corre cada hora, se auto-resuelve.
- **Usuarios y autenticación**: JWT global, bootstrap del primer Superadministrador vía `/auth/registro-inicial`, roles (superadministrador, abogado_administrador, abogado_asociado, asistente_paralegal, facturacion_contabilidad, recepcion), 2FA con TOTP.

Todos los endpoints están documentados en el `README.md` del backend.

## Objetivo de este prompt: lo que falta

### 1. Frontend (React + Tailwind), consumiendo esta API — la pieza pendiente más importante

Pantallas necesarias, una por módulo:

- **Login** con soporte de 2FA (pantalla de código si el backend responde `requiereDosFactor: true`).
- **Dashboard** de inicio: resumen de alertas activas, próximos vencimientos y eventos de agenda del día.
- **Clientes**: listado con búsqueda/filtro (nombre, cédula, pasaporte, RNC, correo), formulario de alta con manejo visible de "posible duplicado detectado" (el backend devuelve `{ duplicados: [...] }`), ficha de detalle.
- **Expedientes**: listado filtrable por estado/materia/cliente, formulario de creación, vista de detalle con historial de cambios visible, botón de restaurar versión (solo visible para Superadministrador), checklist de requisitos con barra de progreso, advertencia visible si se intenta marcar "listo para depositar" con requisitos pendientes.
- **Documentos**: subida (drag & drop), listado por expediente/cliente, historial de versiones, descarga, indicador de confidencialidad, papelera con opción de restaurar (y purgar, solo Superadministrador).
- **Agenda**: vista de calendario (diaria/semanal/mensual) con los eventos por tipo (audiencia, cita, plazo judicial, etc.), creación y edición de eventos.
- **Alertas**: centro de notificaciones con filtro por severidad y estado (vista/no vista, resuelta/activa), pantalla de configuración de reglas (solo superadministrador/abogado_administrador).
- **Usuarios**: gestión de cuentas del equipo (solo Superadministrador) — alta, cambio de estado, asignación de rol.

Requisitos transversales:

- La interfaz debe ocultar o deshabilitar acciones según el rol del usuario autenticado (igual que ya lo valida el backend) — no confiar solo en el backend, dar una buena experiencia visual.
- Diseño responsivo: el equipo de la firma trabajará desde computadoras de oficina, pero debe verse bien también en tablet/celular para consultas rápidas.
- Manejo claro de errores del backend (401 sin sesión, 403 sin permiso, mensajes de validación) traducidos a lenguaje simple para el usuario final, no términos técnicos.

### 2. Preparar el backend para producción

- Sustituir `synchronize: true` por migraciones formales de TypeORM antes de manejar datos reales de clientes (ver nota en `app.module.ts` y `README.md`).
- Separar configuración de entornos: `.env` de desarrollo (Postgres local) vs `.env` de producción (base de datos en la nube — evaluar Neon, que ya se probó, u otro proveedor administrado).
- Revisar CORS en `main.ts` para restringirlo al dominio real del frontend en producción (no dejarlo abierto).
- Definir estrategia de respaldos automáticos de la base de datos (diarios como mínimo, dado que se manejará información confidencial de clientes de una firma legal).
- Definir dónde va a vivir el backend (hosting: Railway, Render, un VPS, etc.) y cómo se despliega (manual vs CI/CD).

### 3. Puesta en marcha para el equipo real

- Crear el primer usuario Superadministrador (`POST /auth/registro-inicial`) con los datos reales del fundador/CEO.
- Dar de alta a los usuarios reales del equipo con su rol correspondiente.
- Cargar (si aplica) las plantillas de requisitos por materia jurídica que usa la firma actualmente, para que el checklist automático tenga sentido desde el día uno.

## Instrucciones para quien tome este prompt

- Antes de escribir código, hacer las preguntas de aclaración necesarias (por ejemplo: ¿qué proveedor de hosting prefiere el cliente?, ¿hay una guía de marca/colores para el frontend?, ¿cuántos usuarios del equipo hay que dar de alta?).
- Seguir los mismos patrones ya usados en el backend (estructura de módulos NestJS) si se agrega algo ahí.
- Probar cada flujo de extremo a extremo antes de darlo por terminado, igual que se hizo con cada módulo del backend (ver ejemplos de pruebas en el `README.md`).
- El usuario que dará seguimiento a este proyecto no tiene experiencia técnica — cualquier paso que requiera que él ejecute algo (comandos, configuración) debe explicarse de forma simple, uno a la vez.
