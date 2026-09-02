# Prompt: Construir el Frontend de JAYM Legal (para correr en local primero)

> Copia y pega este documento completo al inicio de una conversación con un desarrollador o con una herramienta de IA para programar (Claude Code, Cursor, etc.). El objetivo de esta fase es **solo local**: tener el frontend funcionando en la propia computadora, conectado al backend que ya corre en `http://localhost:3000`, para que el dueño del proyecto lo revise y apruebe antes de pensar en producción. **No incluir todavía nada de hosting, dominio ni base de datos en la nube — eso es una fase aparte.**

## Contexto

JAYM Legal Multiservices es una firma legal en La Romana, República Dominicana. Ya existe un backend completo y probado (NestJS + TypeORM + PostgreSQL) corriendo localmente en `http://localhost:3000` (proyecto `jaym-legal-backend`, ver su `README.md` para el detalle de cada endpoint). CORS ya está habilitado sin restricciones (`app.enableCors()` en `main.ts`), así que el frontend puede consumirlo sin configuración adicional por ahora.

Falta construir el frontend: la interfaz visual que consume esa API. Esta es la única pieza pendiente del MVP.

## Objetivo de esta fase

Crear un proyecto de frontend nuevo (carpeta separada, ej. `jaym-legal-frontend`, hermana de `jaym-legal-backend`) en **React + Tailwind** (usar Vite como herramienta de build — arranque rápido y sencillo para desarrollo local), que:

1. Corra localmente con un solo comando (`npm run dev`).
2. Se conecte a `http://localhost:3000` (dejar la URL de la API en una variable de entorno, ej. `VITE_API_URL`, para poder cambiarla fácilmente cuando se despliegue a producción más adelante).
3. Cubra todas las pantallas necesarias para poder probar el sistema completo de principio a fin con datos reales de prueba.

## Pantallas a construir

- **Login** (`POST /auth/login`), con manejo del caso `requiereDosFactor: true` (pantalla para ingresar el código de 6 dígitos).
- **Registro inicial** (`POST /auth/registro-inicial`) — pantalla o script de un solo uso para crear el primer Superadministrador (solo funciona si no hay ningún usuario todavía).
- **Dashboard**: resumen de alertas activas, próximos vencimientos y eventos de agenda del día.
- **Clientes**: listado con búsqueda (`GET /clientes?q=&tipo=`), formulario de alta que muestre visiblemente el aviso de "posible duplicado" cuando el backend responda `{ duplicados: [...] }` (con opción de confirmar y crear igual usando `?forzar=true`), ficha de detalle (`GET /clientes/:id`).
- **Expedientes**: listado filtrable (`GET /expedientes?estado=&materia=&clienteId=`), formulario de creación, vista de detalle con historial de cambios (`GET /expedientes/:expedienteId/historial`), botón de restaurar versión (solo visible si el usuario logueado es Superadministrador), checklist de requisitos con barra de progreso (`GET /expedientes/:id/requisitos/progreso`), aviso si se marca "listo_para_depositar" con pendientes (`advertenciaDeposito` en la respuesta del `PATCH`).
- **Documentos**: subida (`POST /documentos`, multipart), listado por expediente/cliente, ver versiones (`GET /documentos/:id/versiones`), descarga, indicador visual de confidencialidad, papelera (`GET /documentos/papelera`) con restaurar y purgar (purgar solo visible para Superadministrador).
- **Agenda**: vista de calendario simple (lista por día/semana está bien para esta fase; no hace falta un calendario visual complejo todavía) con `GET/POST /agenda` y `GET/PATCH /agenda/:id`.
- **Alertas**: listado filtrable por severidad y estado (`GET /alertas?resuelta=&severidad=&expedienteId=`), marcar como vista (`PATCH /alertas/:id/vista`), pantalla de configuración de reglas (`GET/PATCH /alertas/config`) solo para superadministrador/abogado_administrador.
- **Usuarios**: listado y alta (`GET/POST /usuarios`), cambio de estado (`PATCH /usuarios/:id/estado`) — solo visible para Superadministrador.

## Reglas importantes

- Guardar el token JWT que devuelve `/auth/login` (en memoria o `localStorage` del navegador) y mandarlo en el header `Authorization: Bearer <token>` en cada petición — todos los endpoints lo exigen salvo login y registro inicial.
- Ocultar o deshabilitar en la interfaz las acciones que el rol del usuario logueado no tiene permitido hacer (aunque el backend ya lo bloquee, la interfaz debe ser clara al respecto para no confundir al usuario con errores 403).
- Traducir los errores del backend a mensajes simples y en español claro (ej. un 401 → "tu sesión expiró, inicia sesión de nuevo"; un 403 → "no tienes permiso para esta acción"; errores de validación → señalar el campo específico).
- No hace falta que se vea perfecto/pulido en esta fase — el objetivo es que **funcione de punta a punta** para que el dueño del proyecto pueda probar cada flujo con datos reales de prueba antes de invertir en diseño visual definitivo.

## Cómo debe quedar para que el dueño del proyecto lo pueda correr

Al terminar, dejar instrucciones simples y numeradas (asumir que quien lo va a correr **no tiene experiencia técnica**) para:

1. Instalar dependencias (`npm install`) dentro de la carpeta del frontend.
2. Confirmar que el backend (`jaym-legal-backend`) esté corriendo en otra ventana de Terminal con `npm run start:dev`.
3. Levantar el frontend (`npm run dev`) y decir exactamente qué dirección abrir en el navegador (normalmente `http://localhost:5173`).
4. Un checklist corto de qué probar primero (ej. "1. Crea tu usuario administrador. 2. Inicia sesión. 3. Crea un cliente de prueba. 4. Crea un expediente para ese cliente...").

## Instrucciones para quien tome este prompt

- Antes de escribir código, preguntar lo necesario si algo no está claro (ej. preferencias de color/estilo, si ya hay un logo para incluir).
- Seguir la estructura de datos y nombres de campos exactamente como están en el backend (ver las entidades en `jaym-legal-backend/src/*/*.entity.ts`) para no tener que traducir nombres entre frontend y backend.
- Probar cada pantalla contra el backend real corriendo en local antes de darla por terminada.
- **No tocar nada del backend** salvo que sea estrictamente necesario para que el frontend funcione (y en ese caso, explicar por qué antes de hacerlo).
- Esta fase es solo para uso local del dueño del proyecto para revisar y aprobar. La puesta en producción (hosting, dominio, base de datos en la nube, seguridad reforzada) es una fase aparte que se abordará después de que él confirme que todo funciona bien localmente — no incluirla aquí.
