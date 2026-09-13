/**
 * Identidad corporativa de la firma — usada por la hoja timbrada (encabezado
 * y pie de página) de todos los documentos impresos/PDF: facturas,
 * cotizaciones y, más adelante, instancias y escritos legales.
 *
 * Centralizado aquí a propósito: un cambio de dirección, teléfono o cuenta
 * bancaria se hace en un solo lugar y se refleja en todos los documentos.
 */
export const MARCA_CORPORATIVA = {
  razonSocial: 'JAYM LEGAL MULTISERVICES SRL',
  rnc: '133540772',
  direccion: 'Calle Emma Balaguer No. 08, Villa Hermosa, La Romana, República Dominicana',
  telefono: '(849) 464-4313',
  correos: ['jaymlegalmultiservices@gmail.com', 'info@jaymlegalmultiservices.com'],
  web: 'https://jaymlegalmultiservices.com',
  eslogan: 'Defendiendo tus derechos con pasión y precisión',
};

// Cláusula de condiciones y política de gestión — se imprime en cada
// cotización y factura, tal como la definió la firma.
export const CLAUSULA_GESTION =
  'Los plazos de respuesta son competencia exclusiva de la institución correspondiente. ' +
  'El profesional asumirá el seguimiento del trámite y realizará gestiones formales a partir ' +
  'de los sesenta (60) días calendario, de ser procedente.';

export const ESTRUCTURA_PAGOS =
  '50% como anticipo; 25% contra constancia de recepción de expediente; y 25% al cierre del proceso.';

export const CUENTAS_BANCARIAS: { banco: string; cuentas: { tipo: string; numero: string }[] }[] = [
  {
    banco: 'Banco de Reservas de la República Dominicana (Banreservas)',
    cuentas: [
      { tipo: 'Cuenta de Ahorros', numero: '9606585640' },
      { tipo: 'Cuenta Corriente', numero: '9609125187' },
    ],
  },
  {
    banco: 'Banco Popular Dominicano',
    cuentas: [{ tipo: 'Cuenta de Ahorros', numero: '756715439' }],
  },
];
