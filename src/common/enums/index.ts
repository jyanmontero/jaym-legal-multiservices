export enum TipoCliente {
  FISICO = 'fisico',
  JURIDICO = 'juridico',
}

export enum EstadoCliente {
  ACTIVO = 'activo',
  PROSPECTO = 'prospecto',
  INACTIVO = 'inactivo',
}

export enum EstadoCivil {
  SOLTERO = 'soltero',
  CASADO = 'casado',
  DIVORCIADO = 'divorciado',
  VIUDO = 'viudo',
  UNION_LIBRE = 'union_libre',
}

// Materias jurídicas — sección 5 del requerimiento. Configurable a futuro
// mediante una tabla, pero se deja como enum en el MVP para simplicidad.
export enum MateriaJuridica {
  CIVIL = 'civil',
  COMERCIAL = 'comercial',
  PENAL = 'penal',
  LABORAL = 'laboral',
  FAMILIA = 'familia',
  INMOBILIARIO = 'inmobiliario',
  MIGRATORIO = 'migratorio',
  ADMINISTRATIVO = 'administrativo',
  CONSTITUCIONAL = 'constitucional',
  REGISTRO_CIVIL_JCE = 'registro_civil_jce',
  NOTARIAL = 'notarial',
  CORPORATIVO = 'corporativo',
  PROPIEDAD_INTELECTUAL = 'propiedad_intelectual',
  COBROS = 'cobros',
  PROTECCION_CONSUMIDOR = 'proteccion_consumidor',
  SEGURIDAD_SOCIAL = 'seguridad_social',
  OTRA = 'otra',
}

// Prefijo de código de expediente por materia — ej. JAYM-2026-CIV-0001
export const PREFIJO_MATERIA: Record<MateriaJuridica, string> = {
  [MateriaJuridica.CIVIL]: 'CIV',
  [MateriaJuridica.COMERCIAL]: 'COM',
  [MateriaJuridica.PENAL]: 'PEN',
  [MateriaJuridica.LABORAL]: 'LAB',
  [MateriaJuridica.FAMILIA]: 'FAM',
  [MateriaJuridica.INMOBILIARIO]: 'INM',
  [MateriaJuridica.MIGRATORIO]: 'MIG',
  [MateriaJuridica.ADMINISTRATIVO]: 'ADM',
  [MateriaJuridica.CONSTITUCIONAL]: 'CON',
  [MateriaJuridica.REGISTRO_CIVIL_JCE]: 'JCE',
  [MateriaJuridica.NOTARIAL]: 'NOT',
  [MateriaJuridica.CORPORATIVO]: 'CRP',
  [MateriaJuridica.PROPIEDAD_INTELECTUAL]: 'PIN',
  [MateriaJuridica.COBROS]: 'COB',
  [MateriaJuridica.PROTECCION_CONSUMIDOR]: 'PRC',
  [MateriaJuridica.SEGURIDAD_SOCIAL]: 'SEG',
  [MateriaJuridica.OTRA]: 'OTR',
};

export enum EstadoExpediente {
  PROSPECTO = 'prospecto',
  PENDIENTE_CONTRATACION = 'pendiente_contratacion',
  ABIERTO = 'abierto',
  EN_PREPARACION = 'en_preparacion',
  PENDIENTE_DOCUMENTOS = 'pendiente_documentos',
  LISTO_PARA_DEPOSITAR = 'listo_para_depositar',
  DEPOSITADO = 'depositado',
  EN_REVISION_INSTITUCIONAL = 'en_revision_institucional',
  PENDIENTE_RESPUESTA = 'pendiente_respuesta',
  AUDIENCIA_FIJADA = 'audiencia_fijada',
  EN_AUDIENCIA = 'en_audiencia',
  PENDIENTE_DECISION = 'pendiente_decision',
  SENTENCIA_EMITIDA = 'sentencia_emitida',
  EN_RECURSO = 'en_recurso',
  EN_EJECUCION = 'en_ejecucion',
  SUSPENDIDO = 'suspendido',
  CERRADO_FAVORABLE = 'cerrado_favorablemente',
  CERRADO_DESFAVORABLE = 'cerrado_desfavorablemente',
  ARCHIVADO = 'archivado',
}

export enum NivelPrioridad {
  BAJA = 'baja',
  MEDIA = 'media',
  ALTA = 'alta',
  URGENTE = 'urgente',
}

export enum NivelRiesgo {
  BAJO = 'bajo',
  MEDIO = 'medio',
  ALTO = 'alto',
}

// Roles de personal interno — sección 15 del requerimiento. El rol
// "Cliente con acceso limitado" vive por separado en portal_usuarios
// (Etapa 5), no en esta tabla de usuarios internos.
export enum RolUsuario {
  SUPERADMINISTRADOR = 'superadministrador',
  ABOGADO_ADMINISTRADOR = 'abogado_administrador',
  ABOGADO_ASOCIADO = 'abogado_asociado',
  ASISTENTE_PARALEGAL = 'asistente_paralegal',
  FACTURACION_CONTABILIDAD = 'facturacion_contabilidad',
  RECEPCION = 'recepcion',
}

export enum EstadoUsuario {
  ACTIVO = 'activo',
  SUSPENDIDO = 'suspendido',
  INVITADO = 'invitado',
}

// Categorías de documento — sección 12 del requerimiento.
export enum CategoriaDocumento {
  IDENTIFICACION = 'identificacion',
  PODERES = 'poderes',
  CONTRATOS = 'contratos',
  INSTANCIAS = 'instancias',
  ACTOS_ALGUACIL = 'actos_alguacil',
  PRUEBAS = 'pruebas',
  CERTIFICACIONES = 'certificaciones',
  SENTENCIAS = 'sentencias',
  RESOLUCIONES = 'resoluciones',
  FACTURAS = 'facturas',
  RECIBOS = 'recibos',
  CORRESPONDENCIAS = 'correspondencias',
  INFORMES = 'informes',
  FORMULARIOS = 'formularios',
  OTROS = 'otros',
}

export enum EstadoCalidadDocumento {
  LEGIBLE = 'legible',
  ILEGIBLE = 'ilegible',
  REQUIERE_TRADUCCION = 'requiere_traduccion',
  REQUIERE_APOSTILLA = 'requiere_apostilla',
  REQUIERE_LEGALIZACION = 'requiere_legalizacion',
}

// Roles internos que, por defecto, siempre pueden ver/descargar documentos
// marcados como confidenciales, sin necesidad de un permiso explícito en
// documento_permisos. El resto de los roles necesita un permiso explícito.
// Roles con visibilidad total de expedientes (ven los de todos los
// abogados). El resto de roles con acceso al módulo (abogado asociado,
// asistente/paralegal) solo ve los expedientes donde es el responsable
// asignado, más los que todavía no tienen responsable asignado -- para que
// un caso sin asignar no desaparezca de la vista de nadie.
export const ROLES_CON_VISIBILIDAD_TOTAL_EXPEDIENTES = [
  RolUsuario.SUPERADMINISTRADOR,
  RolUsuario.ABOGADO_ADMINISTRADOR,
];

export const ROLES_CON_ACCESO_CONFIDENCIAL_POR_DEFECTO = [
  RolUsuario.SUPERADMINISTRADOR,
  RolUsuario.ABOGADO_ADMINISTRADOR,
];

// Estado de un requisito de expediente — sección 8 del requerimiento.
export enum EstadoRequisito {
  PENDIENTE = 'pendiente',
  EN_PROCESO = 'en_proceso',
  COMPLETO = 'completo',
  NO_APLICA = 'no_aplica',
}

// --- Agenda — sección 9 del requerimiento ---
export enum TipoEventoAgenda {
  AUDIENCIA = 'audiencia',
  CITA = 'cita',
  REUNION = 'reunion',
  DEPOSITO = 'deposito',
  SEGUIMIENTO = 'seguimiento',
  VENCIMIENTO = 'vencimiento',
  LLAMADA = 'llamada',
  TAREA_INTERNA = 'tarea_interna',
  PLAZO_JUDICIAL = 'plazo_judicial',
}

export enum EstadoEventoAgenda {
  PENDIENTE = 'pendiente',
  CONFIRMADO = 'confirmado',
  COMPLETADO = 'completado',
  CANCELADO = 'cancelado',
  REPROGRAMADO = 'reprogramado',
}

// --- Alertas — sección 14 del requerimiento ---
export enum TipoReglaAlerta {
  EXPEDIENTE_SIN_MOVIMIENTO = 'expediente_sin_movimiento',
  PLAZO_PROXIMO = 'plazo_proximo',
  PLAZO_VENCIDO = 'plazo_vencido',
  DOCUMENTO_VENCIDO = 'documento_vencido',
  REQUISITO_PENDIENTE_VENCIDO = 'requisito_pendiente_vencido',
  EVENTO_PROXIMO = 'evento_proximo',
  EVENTO_VENCIDO = 'evento_vencido',
  FACTURA_VENCIDA = 'factura_vencida',
}

export enum SeveridadAlerta {
  INFORMATIVA = 'informativa',
  ATENCION = 'atencion',
  URGENTE = 'urgente',
  CRITICA = 'critica',
}

// --- Facturación y Contabilidad ---
export enum EstadoCotizacion {
  BORRADOR = 'borrador',
  ENVIADA = 'enviada',
  ACEPTADA = 'aceptada',
  RECHAZADA = 'rechazada',
  CONVERTIDA = 'convertida', // ya se generó una factura a partir de esta cotización
}

export enum EstadoFactura {
  PENDIENTE = 'pendiente',
  PAGADA_PARCIAL = 'pagada_parcial',
  PAGADA = 'pagada',
  ANULADA = 'anulada',
}

export enum MetodoPago {
  EFECTIVO = 'efectivo',
  TRANSFERENCIA = 'transferencia',
  CHEQUE = 'cheque',
  TARJETA = 'tarjeta',
  OTRO = 'otro',
}

// Roles con acceso al módulo de Facturación y Contabilidad. Nota: por ahora
// deliberadamente no incluye a abogado_asociado ni recepción — se puede
// abrir más adelante (ej. solo lectura del estado de cuenta de sus propios
// clientes) si la firma lo requiere.
export const ROLES_CON_ACCESO_FACTURACION = [
  RolUsuario.SUPERADMINISTRADOR,
  RolUsuario.ABOGADO_ADMINISTRADOR,
  RolUsuario.FACTURACION_CONTABILIDAD,
];

// --- Plantillas de documentos (contratos, poderes, etc. rellenables) ---
export enum EstadoSolicitudDocumento {
  PENDIENTE_CLIENTE = 'pendiente_cliente',
  PENDIENTE_APROBACION = 'pendiente_aprobacion',
  APROBADO = 'aprobado',
  RECHAZADO = 'rechazado',
}

// Roles que pueden crear una solicitud de documento (elegir la plantilla,
// vincularla a un cliente/expediente y generar el enlace público) y verla
// en el listado interno. La aprobación final -- la que efectivamente genera
// el PDF -- queda restringida a un grupo más pequeño (ver abajo), porque es
// la firma final de la oficina sobre el contenido del documento.
export const ROLES_CON_ACCESO_PLANTILLAS = [
  RolUsuario.SUPERADMINISTRADOR,
  RolUsuario.ABOGADO_ADMINISTRADOR,
  RolUsuario.ABOGADO_ASOCIADO,
  RolUsuario.ASISTENTE_PARALEGAL,
];

export const ROLES_QUE_APRUEBAN_PLANTILLAS = [
  RolUsuario.SUPERADMINISTRADOR,
  RolUsuario.ABOGADO_ADMINISTRADOR,
];

// Tasa de ITBIS estándar en República Dominicana. Algunos servicios pueden
// estar exentos o llevar una tasa distinta — por eso cada factura/cotización
// permite desactivarlo (aplicaItbis: false) en vez de asumirlo siempre.
export const TASA_ITBIS = 0.18;
