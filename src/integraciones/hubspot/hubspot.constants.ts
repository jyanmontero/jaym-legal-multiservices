import { EstadoExpediente } from '../../common/enums/index.js';

/**
 * HubSpot exige que cada Custom Property exista en el portal ANTES de
 * poder escribirle un valor por API (a diferencia de las columnas de
 * nuestra propia base de datos, que TypeORM crea solas). Estos son los
 * "internal name" que este servicio espera encontrar ya creados en
 * Configuración > Propiedades > Contactos/Negocios del portal 51539725.
 * El endpoint POST /integraciones/hubspot/configurar las crea solo si no
 * existen — no requiere pasos manuales en HubSpot.
 */
export const PROPIEDADES_CONTACTO_JAYM = {
  cedulaORnc: 'cedula_rnc',
  tipoCliente: 'tipo_cliente_jaym',
  codigoCliente: 'codigo_cliente_jaym',
} as const;

export const PROPIEDADES_DEAL_JAYM = {
  codigoExpediente: 'codigo_expediente_jaym',
  tipoCaso: 'materia_juridica_jaym',
  balancePendiente: 'balance_pendiente_jaym',
} as const;

/**
 * Nombre exacto del pipeline de negocios en HubSpot que este sistema busca
 * y usa. Debe crearse UNA VEZ manualmente en HubSpot (Configuración >
 * Objetos > Negocios > Pipelines) con este nombre exacto y estas 5 etapas,
 * en este orden, con esos nombres exactos:
 *   1. Recepción
 *   2. Solicitud Administrativa
 *   3. Vía Contenciosa
 *   4. Cerrado - Favorable   (marcada como "Closed won" / Cerrado ganado)
 *   5. Cerrado - Desfavorable (marcada como "Closed lost" / Cerrado perdido)
 *
 * Este servicio busca el pipeline y sus etapas POR NOMBRE cada vez que
 * hace falta (con caché en memoria) — así no hace falta copiar ningún ID
 * técnico a mano ni configurar variables de entorno para esto.
 */
export const NOMBRE_PIPELINE_JAYM = 'Casos JAYM LEGAL';

export const NOMBRES_ETAPAS_JAYM = {
  RECEPCION: 'Recepción',
  SOLICITUD_ADMINISTRATIVA: 'Solicitud Administrativa',
  VIA_CONTENCIOSA: 'Vía Contenciosa',
  CIERRE_FAVORABLE: 'Cerrado - Favorable',
  CIERRE_DESFAVORABLE: 'Cerrado - Desfavorable',
} as const;

export type EtapaHubSpot = keyof typeof NOMBRES_ETAPAS_JAYM;

/**
 * Las 19 fases granulares de EstadoExpediente se agrupan en las 5 etapas
 * de arriba. "Cierre" se abre en Favorable/Desfavorable porque HubSpot
 * exige que cada pipeline tenga una etapa "ganada" y una "perdida" — esto
 * además queda más preciso que un solo "Cierre" genérico.
 */
export const ETAPA_POR_ESTADO: Record<EstadoExpediente, EtapaHubSpot> = {
  [EstadoExpediente.PROSPECTO]: 'RECEPCION',
  [EstadoExpediente.PENDIENTE_CONTRATACION]: 'RECEPCION',
  [EstadoExpediente.ABIERTO]: 'RECEPCION',
  [EstadoExpediente.EN_PREPARACION]: 'RECEPCION',
  [EstadoExpediente.PENDIENTE_DOCUMENTOS]: 'RECEPCION',
  [EstadoExpediente.LISTO_PARA_DEPOSITAR]: 'SOLICITUD_ADMINISTRATIVA',
  [EstadoExpediente.DEPOSITADO]: 'SOLICITUD_ADMINISTRATIVA',
  [EstadoExpediente.EN_REVISION_INSTITUCIONAL]: 'SOLICITUD_ADMINISTRATIVA',
  [EstadoExpediente.PENDIENTE_RESPUESTA]: 'SOLICITUD_ADMINISTRATIVA',
  [EstadoExpediente.AUDIENCIA_FIJADA]: 'VIA_CONTENCIOSA',
  [EstadoExpediente.EN_AUDIENCIA]: 'VIA_CONTENCIOSA',
  [EstadoExpediente.PENDIENTE_DECISION]: 'VIA_CONTENCIOSA',
  [EstadoExpediente.SENTENCIA_EMITIDA]: 'VIA_CONTENCIOSA',
  [EstadoExpediente.EN_RECURSO]: 'VIA_CONTENCIOSA',
  [EstadoExpediente.EN_EJECUCION]: 'VIA_CONTENCIOSA',
  [EstadoExpediente.SUSPENDIDO]: 'VIA_CONTENCIOSA',
  [EstadoExpediente.CERRADO_FAVORABLE]: 'CIERRE_FAVORABLE',
  [EstadoExpediente.CERRADO_DESFAVORABLE]: 'CIERRE_DESFAVORABLE',
  [EstadoExpediente.ARCHIVADO]: 'CIERRE_DESFAVORABLE',
};
