#!/usr/bin/env node
/**
 * Migracion de datos historicos de Brisk Invoicing hacia JAYM LEGAL.
 *
 * Uso:
 *   node scripts/migrar-brisk.mjs --dry-run     (revisa todo sin escribir nada)
 *   node scripts/migrar-brisk.mjs               (ejecuta la migracion real)
 *
 * Requisitos:
 *   - El backend de JAYM LEGAL debe estar corriendo (npm run start:dev).
 *   - Node 18+ (usa fetch nativo).
 *   - El archivo scripts/datos-brisk.json debe estar en la misma carpeta.
 *
 * El script pide tu correo/contraseña (y codigo de 2FA si lo tienes activo)
 * por terminal -- nunca quedan guardados en ningun archivo.
 *
 * Es seguro volver a correrlo si se interrumpe a medias: guarda su progreso
 * en scripts/estado-migracion.json y se salta lo que ya quedo creado.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const DRY_RUN = process.argv.includes('--dry-run');
const DATOS_PATH = join(__dirname, 'datos-brisk.json');
const ESTADO_PATH = join(__dirname, 'estado-migracion.json');

function cargarEstado() {
  if (existsSync(ESTADO_PATH)) {
    return JSON.parse(readFileSync(ESTADO_PATH, 'utf-8'));
  }
  return { clientesCreados: {}, cotizacionesCreadas: {}, facturasCreadas: {} };
}

function guardarEstado(estado) {
  writeFileSync(ESTADO_PATH, JSON.stringify(estado, null, 2));
}

async function preguntar(rl, texto, oculto = false) {
  if (!oculto) return (await rl.question(texto)).trim();
  // Ocultar la contraseña mientras se escribe
  return new Promise((resolve) => {
    const onData = (char) => {
      char = char.toString('utf8');
      if (char === '\n' || char === '\r' || char === '') {
        stdin.removeListener('data', onData);
      }
    };
    stdin.on('data', onData);
    rl.question(texto).then((respuesta) => resolve(respuesta.trim()));
  });
}

async function login() {
  const rl = createInterface({ input: stdin, output: stdout });
  console.log('\n=== Inicio de sesion en JAYM LEGAL (' + BACKEND_URL + ') ===');
  const correo = await preguntar(rl, 'Correo: ');
  const password = await preguntar(rl, 'Contraseña: ', true);
  let codigoDosFactor;
  const tiene2fa = (await preguntar(rl, '¿Tienes verificacion en 2 pasos activa? (s/n): ')).toLowerCase();
  if (tiene2fa === 's' || tiene2fa === 'si') {
    codigoDosFactor = await preguntar(rl, 'Codigo de 6 digitos: ');
  }
  rl.close();

  const resp = await fetch(`${BACKEND_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, password, codigoDosFactor }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`No se pudo iniciar sesion (${resp.status}): ${err}`);
  }
  const data = await resp.json();
  const token = data.accessToken || data.token || data.access_token;
  if (!token) {
    throw new Error('El login respondio OK pero no encontre el token en la respuesta: ' + JSON.stringify(data));
  }
  console.log('Sesion iniciada correctamente.\n');
  return token;
}

async function api(token, method, ruta, body) {
  const resp = await fetch(`${BACKEND_URL}${ruta}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await resp.text();
  let json;
  try { json = texto ? JSON.parse(texto) : {}; } catch { json = { raw: texto }; }
  if (!resp.ok) {
    throw new Error(`${method} ${ruta} -> ${resp.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

function construirDtoCliente(c) {
  const dto = {
    tipo: c.tipo,
    nacionalidad: c.nacionalidad,
    direccion: c.direccion,
    observaciones: c.observaciones,
  };
  if (c.tipo === 'fisico') {
    dto.nombres = c.nombres;
    dto.apellidos = c.apellidos;
  } else {
    dto.razonSocial = c.razonSocial;
    if (c.rnc) dto.rnc = c.rnc;
  }
  return dto;
}

function normalizarNombre(s) {
  return (s || '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function nombreEsperado(c) {
  return c.tipo === 'fisico'
    ? normalizarNombre(`${c.nombres || ''} ${c.apellidos || ''}`)
    : normalizarNombre(c.razonSocial);
}

function nombreClienteExistente(cliente) {
  return cliente.tipo === 'juridico'
    ? normalizarNombre(cliente.razonSocial || cliente.nombreComercial || '')
    : normalizarNombre(`${cliente.nombres || ''} ${cliente.apellidos || ''}`);
}

// Trae TODOS los clientes ya existentes en JAYM LEGAL y arma un mapa
// nombre-normalizado -> id. Se usa para no duplicar clientes si el script
// se corre mas de una vez (por ejemplo, si una corrida anterior si los
// creo pero no pudo guardar el id localmente).
async function precargarClientesExistentes(token, estado, datos) {
  const existentes = await api(token, 'GET', '/clientes', undefined);
  const porNombre = new Map();
  for (const cl of existentes) {
    porNombre.set(nombreClienteExistente(cl), cl);
  }
  let reutilizados = 0;
  for (const c of datos.clientes) {
    if (estado.clientesCreados[c.clave]) continue;
    const encontrado = porNombre.get(nombreEsperado(c));
    if (encontrado) {
      estado.clientesCreados[c.clave] = encontrado.id;
      reutilizados++;
    }
  }
  if (reutilizados > 0) {
    guardarEstado(estado);
    console.log(`(${reutilizados} clientes ya existian en JAYM LEGAL con ese mismo nombre -- se reutilizan en vez de crearlos de nuevo)`);
  }
}

async function main() {
  const datos = JSON.parse(readFileSync(DATOS_PATH, 'utf-8'));
  const estado = cargarEstado();

  console.log(`Datos cargados: ${datos.clientes.length} clientes, ${datos.cotizaciones.length} cotizaciones, ${datos.facturas.length} facturas.`);
  if (Object.keys(datos.clientesOmitidos || {}).length) {
    console.log('\nClientes que se OMITEN a proposito (ya existen en JAYM LEGAL):');
    for (const [nombre, motivo] of Object.entries(datos.clientesOmitidos)) {
      console.log(`  - ${nombre}: ${motivo}`);
    }
  }

  if (DRY_RUN) {
    console.log('\n*** MODO DRY-RUN: no se va a escribir nada en la base de datos. ***\n');
  }

  const token = DRY_RUN ? null : await login();

  if (!DRY_RUN) {
    await precargarClientesExistentes(token, estado, datos);
  }

  // --- 1) Clientes -----------------------------------------------------
  console.log('\n--- Clientes ---');
  for (const c of datos.clientes) {
    if (estado.clientesCreados[c.clave]) {
      console.log(`(ya existe) ${c.clave} -> ${estado.clientesCreados[c.clave]}`);
      continue;
    }
    const dto = construirDtoCliente(c);
    if (DRY_RUN) {
      console.log(`[dry-run] crearia cliente: ${c.clave} (${c.tipo})`);
      continue;
    }
    try {
      const resp = await api(token, 'POST', '/clientes', dto);
      if (resp.duplicados) {
        console.error(`FALLO cliente ${c.clave}: JAYM LEGAL detecto un posible duplicado y no lo creo: ${JSON.stringify(resp.duplicados)}`);
        continue;
      }
      const creado = resp.cliente;
      estado.clientesCreados[c.clave] = creado.id;
      guardarEstado(estado);
      console.log(`OK  cliente creado: ${c.clave} -> ${creado.codigoCliente || creado.id}`);
    } catch (e) {
      console.error(`FALLO cliente ${c.clave}: ${e.message}`);
    }
  }

  // --- 2) Cotizaciones abiertas -----------------------------------------
  console.log('\n--- Cotizaciones abiertas ---');
  for (const cot of datos.cotizaciones) {
    const key = `COT-${cot.numeroBrisk}`;
    if (estado.cotizacionesCreadas[key]) {
      console.log(`(ya creada antes) ${key}`);
      continue;
    }
    const clienteId = estado.clientesCreados[cot.clienteClave];
    if (DRY_RUN) {
      console.log(`[dry-run] crearia cotizacion Brisk Nº ${cot.numeroBrisk} para ${cot.clienteClave}`);
      continue;
    }
    if (!clienteId) {
      console.error(`SALTADA cotizacion ${cot.numeroBrisk}: no hay clienteId para ${cot.clienteClave} (¿fallo su creacion?).`);
      continue;
    }
    try {
      const dto = {
        clienteId,
        concepto: cot.concepto,
        items: cot.items,
        aplicaItbis: cot.aplicaItbis,
        descuento: cot.descuento || undefined,
        notas: cot.notas,
      };
      const creada = await api(token, 'POST', '/cotizaciones', dto);
      await api(token, 'POST', `/cotizaciones/${creada.id}/estado`, { estado: cot.estadoDestino });
      estado.cotizacionesCreadas[key] = creada.id;
      guardarEstado(estado);
      console.log(`OK  cotizacion creada: Brisk Nº ${cot.numeroBrisk} -> ${creada.numero}`);
    } catch (e) {
      console.error(`FALLO cotizacion ${cot.numeroBrisk}: ${e.message}`);
    }
  }

  // --- 3) Facturas + pagos ----------------------------------------------
  console.log('\n--- Facturas ---');
  for (const fac of datos.facturas) {
    const key = `FAC-${fac.numeroBrisk}`;
    if (estado.facturasCreadas[key]) {
      console.log(`(ya creada antes) ${key}`);
      continue;
    }
    const clienteId = estado.clientesCreados[fac.clienteClave];
    if (DRY_RUN) {
      console.log(`[dry-run] crearia factura Brisk Nº ${fac.numeroBrisk} (${fac.estadoOriginalBrisk}) para ${fac.clienteClave}` + (fac.pago ? ` + pago de $${fac.pago.monto}` : ''));
      continue;
    }
    if (!clienteId) {
      console.error(`SALTADA factura ${fac.numeroBrisk}: no hay clienteId para ${fac.clienteClave}.`);
      continue;
    }
    try {
      const dto = {
        clienteId,
        concepto: fac.concepto,
        items: fac.items,
        aplicaItbis: fac.aplicaItbis,
        fechaEmision: fac.fechaEmision,
        fechaVencimiento: fac.fechaVencimiento,
        notas: fac.notas,
      };
      const creada = await api(token, 'POST', '/facturas', dto);
      if (fac.pago) {
        await api(token, 'POST', `/facturas/${creada.id}/pagos`, {
          monto: fac.pago.monto,
          metodo: fac.pago.metodo,
          fecha: fac.pago.fecha,
          notas: fac.pago.notas,
        });
      }
      estado.facturasCreadas[key] = creada.id;
      guardarEstado(estado);
      console.log(`OK  factura creada: Brisk Nº ${fac.numeroBrisk} -> ${creada.numero}${fac.pago ? ' (con pago registrado)' : ''}`);
    } catch (e) {
      console.error(`FALLO factura ${fac.numeroBrisk}: ${e.message}`);
    }
  }

  console.log('\n=== Listo. Revisa los clientes y facturas migrados en JAYM LEGAL antes de darlos por buenos. ===');
}

main().catch((e) => {
  console.error('\nError fatal:', e.message);
  process.exit(1);
});
