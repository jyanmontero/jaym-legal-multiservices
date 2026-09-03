# Migración Brisk Invoicing → JAYM LEGAL — notas y supuestos

Preparado a partir de los 4 PDFs que subiste (Informe de cotizaciones, Informe de facturas, Informe de cuentas pendientes de pago) más 2 documentos individuales de muestra (cotización 10047 y factura B1000000013) que sí traían el detalle línea por línea.

## Qué hace el paquete

- `datos-brisk.json` — 45 clientes, 30 cotizaciones abiertas y 23 facturas (con sus pagos), listos para crear en JAYM LEGAL vía su propia API.
- `migrar-brisk.mjs` — script de Node que lee ese JSON y lo carga al sistema, pidiéndote tu correo/contraseña (y código de 2FA si lo usas) por terminal. Nunca guarda tu contraseña en ningún archivo.

## Cómo correrlo

1. Con el backend corriendo (`npm run start:dev`), primero en modo de prueba (no escribe nada):
   ```
   node scripts/migrar-brisk.mjs --dry-run
   ```
   Revisa que la lista tenga sentido.
2. Si todo se ve bien, corre la migración real:
   ```
   node scripts/migrar-brisk.mjs
   ```
   Te va a pedir tu correo y contraseña de JAYM LEGAL (y el código de 6 dígitos si tienes verificación en 2 pasos activa).
3. Si se corta a medias (por ejemplo, se cae el backend), puedes volver a correrlo tal cual — se salta lo que ya haya creado antes.

## Cosas que SÍ pude reconstruir con precisión

- Los 62 registros (37 cotizaciones + 25 facturas) están tomados literalmente de tus reportes de Brisk — nombre del cliente, fecha, número original, monto y estado.
- Encontré una factura más reciente (B1000000013, Franck Mathus Federico, $28,320.00) que no salió en el reporte porque es más nueva que el corte del reporte — la incluí también, con su detalle real de línea (la única factura, junto con la cotización 10047 de Katiana Rafaela Mercedes, de la que sí tengo el desglose completo con ITBIS).
- Para 5 clientes con saldo pendiente reportado al 2026-09-02 (Samuel Florentino, Santa Gil Rene, Valeria García Flurant, Yahaira Miguelina González Jiménez, Iris Geremías), crucé ese saldo contra sus facturas individuales para reconstruir qué parte está pagada. El caso de Samuel Florentino necesitó dividir el saldo entre sus dos facturas (B1000000004 sin pagar + B1000000005 con un pago parcial de $35,000 reconstruido matemáticamente).

## Cosas que NO pude saber y tuve que asumir — por favor revísalas

1. **Iris Geremías se omite por completo.** Ya existe como cliente CL-0001 en JAYM LEGAL con facturas cargadas manualmente (incluyendo una que coincide en monto y saldo con su historial real de Brisk). No quise arriesgarme a duplicarla. Si faltan sus otras 2 facturas de Brisk (B1000000010 y B1000000011, ambas "Pagado", $129,929.80 cada una), cárgalas tú a mano o dime y las agrego yo después de que confirmes que no están ya.

2. **Cédula/pasaporte/RNC, correo, teléfono y dirección real de casi todos los clientes: no existen en los reportes de Brisk.** Solo tengo el RNC de un cliente (Arisleni Rodríguez Mamacho / Noguera y Hermanos, RNC 130632022) y una dirección parcial de 2 clientes (Katiana Rafaela Mercedes, Franck Mathus Federico). El resto queda con "No disponible — pendiente de completar" en dirección y sin cédula/correo/teléfono. Vas a tener que completar estos datos cliente por cliente cuando tengas tiempo — sin eso, el sistema no puede generar comprobantes fiscales (NCF) válidos a nombre de esos clientes.

3. **Detalle línea por línea: solo lo tengo para 2 de los 62 registros.** Todo lo demás se migró como una sola línea "Servicios legales — migrado de Brisk Invoicing" por el monto total, sin desglose de ITBIS (para no arriesgarme a que el total recalculado no cuadre con el de Brisk). Si quieres el desglose real de qué servicio fue cada cotización/factura, tendría que sacarlo directamente del panel de Brisk (necesito que inicies sesión tú mismo ahí, yo no puedo ni debo escribir tu contraseña).

4. **Fecha de vencimiento: asumí 30 días después de la fecha de emisión para todas.** Lo verifiqu­é contra los 5 casos donde Brisk sí me dio la fecha de vencimiento real (coincide exacto en los 5), así que es un supuesto razonablemente confiable — pero sigue siendo un supuesto.

5. **Fecha del pago (para facturas "Pagado"): usé la misma fecha de la factura**, porque Brisk no exporta la fecha real en que se recibió el pago. El monto sí es exacto; la fecha es aproximada.

6. **4 facturas marcadas "Parcial" en Brisk que NO aparecen en el reporte de cuentas pendientes al 2026-09-02** (Tita Paulino Pérez, sumayel Katherine de los Santos, Fior D'aliza Rodríguez Solano, Lormelus Celión) — asumí que ya están saldadas por completo, porque su ausencia del reporte de pendientes es la única evidencia que tengo. **Esto es lo menos confiable del paquete — te recomiendo verificarlo con cada cliente o con tu registro bancario antes de confiar en el flujo de caja que muestre el sistema.**

7. **Clientes "conjuntos"** (más de una persona en una sola cotización/factura, ej. "Marie Judith Pascal & Ricaye Love Christophe") se migraron como un solo cliente con el nombre completo. Sepáralos en registros individuales si prefieres facturarles por separado en el futuro.

8. **Nacionalidad:** asumí "Dominicana" para todos por defecto — corrígela si algún cliente es extranjero (probable en trámites migratorios).

9. **Separación de nombres/apellidos:** usé una regla simple (dividir las palabras del nombre a la mitad). El nombre completo siempre queda preservado, pero puede que algún apellido quede mal cortado — es cosmético, fácil de corregir en la ficha del cliente.

## Recomendación

Corre primero `--dry-run`, revisa la lista de 45 clientes conmigo o con quien maneje la contabilidad, decide qué hacer con el punto 6 (las 4 facturas "Parcial" asumidas como pagadas), y luego corre la migración real. Después de correrla, no está de más comparar el dashboard de cobros de JAYM contra el saldo pendiente real de Brisk ($365,990.20 al 2026-09-02, sin contar a Iris) para confirmar que cuadra.
