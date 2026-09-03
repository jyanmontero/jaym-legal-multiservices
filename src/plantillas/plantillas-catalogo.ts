/**
 * Catálogo de plantillas de documentos — sección "venta de contratos y
 * traducciones" de la hoja de ruta.
 *
 * Por decisión explícita (ver conversación con el usuario), este catálogo
 * vive fijo en el código por ahora, en vez de una tabla editable desde la
 * interfaz. Para agregar o modificar una plantilla, se edita este archivo.
 *
 * Cada plantilla define sus campos (lo único que la persona debe llenar) y
 * un "cuerpo" de texto con marcadores {{clave}} que se reemplazan por el
 * valor capturado al momento de generar el documento final.
 */

export type TipoCampoPlantilla = 'texto' | 'numero' | 'fecha' | 'textarea';

export interface CampoPlantilla {
  clave: string;
  etiqueta: string;
  tipo: TipoCampoPlantilla;
  requerido: boolean;
  ayuda?: string;
}

export interface PlantillaDocumento {
  clave: string;
  nombre: string;
  descripcion: string;
  // Precio de venta al público, en RD$. Se copia a la solicitud en el
  // momento de crearla (ver PlantillasService.crear) para que un cambio de
  // precio a futuro no altere solicitudes ya generadas.
  precio: number;
  campos: CampoPlantilla[];
  cuerpo: string;
}

export const CATALOGO_PLANTILLAS: PlantillaDocumento[] = [
  {
    clave: 'compraventa_bienes_muebles',
    nombre: 'Contrato de Compraventa de Bienes Muebles',
    descripcion: 'Venta de un bien mueble (vehículo, equipo, mobiliario, etc.) entre dos personas.',
    precio: 1200,
    campos: [
      { clave: 'vendedorNombre', etiqueta: 'Nombre completo del vendedor', tipo: 'texto', requerido: true },
      { clave: 'vendedorCedula', etiqueta: 'Cédula o pasaporte del vendedor', tipo: 'texto', requerido: true },
      { clave: 'vendedorDireccion', etiqueta: 'Dirección del vendedor', tipo: 'texto', requerido: true },
      { clave: 'compradorNombre', etiqueta: 'Nombre completo del comprador', tipo: 'texto', requerido: true },
      { clave: 'compradorCedula', etiqueta: 'Cédula o pasaporte del comprador', tipo: 'texto', requerido: true },
      { clave: 'compradorDireccion', etiqueta: 'Dirección del comprador', tipo: 'texto', requerido: true },
      {
        clave: 'descripcionBien',
        etiqueta: 'Descripción del bien (marca, modelo, año, color, chasis/serie, placa si aplica)',
        tipo: 'textarea',
        requerido: true,
      },
      { clave: 'precioVenta', etiqueta: 'Precio de venta (RD$)', tipo: 'numero', requerido: true },
      { clave: 'formaPago', etiqueta: 'Forma de pago', tipo: 'texto', requerido: true, ayuda: 'Ej. de contado, en 2 partes, etc.' },
      { clave: 'lugarFirma', etiqueta: 'Lugar de la firma', tipo: 'texto', requerido: true },
      { clave: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true },
    ],
    cuerpo: `CONTRATO DE COMPRAVENTA DE BIENES MUEBLES

Entre los suscritos: de una parte, {{vendedorNombre}}, dominicano(a), mayor de edad, portador(a) de la cédula de identidad y electoral / pasaporte No. {{vendedorCedula}}, con domicilio en {{vendedorDireccion}}, quien en lo adelante se denominará EL VENDEDOR; y de la otra parte, {{compradorNombre}}, dominicano(a), mayor de edad, portador(a) de la cédula de identidad y electoral / pasaporte No. {{compradorCedula}}, con domicilio en {{compradorDireccion}}, quien en lo adelante se denominará EL COMPRADOR, se ha convenido y pactado libre y voluntariamente lo siguiente:

PRIMERA: OBJETO. EL VENDEDOR declara ser el único y legítimo propietario del bien mueble que se describe a continuación, y por medio del presente acto lo vende, cede y transfiere a favor de EL COMPRADOR, libre de gravámenes, cargas y oposiciones de cualquier naturaleza:

{{descripcionBien}}

SEGUNDA: PRECIO Y FORMA DE PAGO. El precio convenido para la presente venta es de RD$ {{precioVenta}}, que EL COMPRADOR paga a EL VENDEDOR de la siguiente forma: {{formaPago}}. Con la firma del presente contrato y el pago señalado, EL VENDEDOR otorga a EL COMPRADOR formal recibo de descargo y finiquito legal por dicha suma.

TERCERA: ENTREGA Y GARANTÍA. EL VENDEDOR hace formal entrega material y real del bien objeto de este contrato a EL COMPRADOR, en el estado en que se encuentra y que este último declara conocer y aceptar. EL VENDEDOR garantiza que el bien se encuentra libre de todo gravamen, embargo, litigio, prenda u oposición que pueda afectar el derecho de propiedad que por este acto se transmite, y se compromete a sanear cualquier vicio oculto conforme al derecho común.

CUARTA: TRASPASO Y GASTOS. EL VENDEDOR se compromete a suscribir y entregar cuantos documentos sean necesarios para formalizar el traspaso de la titularidad del bien a favor de EL COMPRADOR ante las autoridades competentes. Los gastos de traspaso, impuestos y trámites correspondientes correrán por cuenta de EL COMPRADOR, salvo pacto distinto entre las partes.

QUINTA: LEY APLICABLE. El presente contrato se rige por las leyes de la República Dominicana. Para todo lo relativo a su interpretación, ejecución y cumplimiento, las partes eligen domicilio en los tribunales competentes de la jurisdicción correspondiente.

Hecho y firmado de buena fe, en dos (2) originales de un mismo tenor y efecto, uno para cada parte, en {{lugarFirma}}, el día {{fecha}}.


_______________________________          _______________________________
{{vendedorNombre}}                        {{compradorNombre}}
EL VENDEDOR                               EL COMPRADOR`,
  },

  {
    clave: 'alquiler_vivienda',
    nombre: 'Contrato de Alquiler de Vivienda',
    descripcion: 'Arrendamiento de una vivienda entre propietario e inquilino.',
    precio: 1000,
    campos: [
      { clave: 'arrendadorNombre', etiqueta: 'Nombre completo del arrendador (propietario)', tipo: 'texto', requerido: true },
      { clave: 'arrendadorCedula', etiqueta: 'Cédula o pasaporte del arrendador', tipo: 'texto', requerido: true },
      { clave: 'arrendadorDireccion', etiqueta: 'Dirección del arrendador', tipo: 'texto', requerido: true },
      { clave: 'arrendatarioNombre', etiqueta: 'Nombre completo del arrendatario (inquilino)', tipo: 'texto', requerido: true },
      { clave: 'arrendatarioCedula', etiqueta: 'Cédula o pasaporte del arrendatario', tipo: 'texto', requerido: true },
      { clave: 'direccionInmueble', etiqueta: 'Dirección completa del inmueble alquilado', tipo: 'textarea', requerido: true },
      { clave: 'usoInmueble', etiqueta: 'Uso del inmueble', tipo: 'texto', requerido: true, ayuda: 'Ej. vivienda familiar' },
      { clave: 'canonMensual', etiqueta: 'Canon mensual de alquiler (RD$)', tipo: 'numero', requerido: true },
      { clave: 'diaPago', etiqueta: 'Día(s) de pago de cada mes', tipo: 'texto', requerido: true, ayuda: 'Ej. dentro de los primeros 5 días de cada mes' },
      { clave: 'depositoGarantia', etiqueta: 'Depósito de garantía (RD$)', tipo: 'numero', requerido: true },
      { clave: 'fechaInicio', etiqueta: 'Fecha de inicio del contrato', tipo: 'fecha', requerido: true },
      { clave: 'duracionMeses', etiqueta: 'Duración del contrato (meses)', tipo: 'numero', requerido: true },
      { clave: 'lugarFirma', etiqueta: 'Lugar de la firma', tipo: 'texto', requerido: true },
      { clave: 'fecha', etiqueta: 'Fecha de la firma', tipo: 'fecha', requerido: true },
    ],
    cuerpo: `CONTRATO DE ALQUILER DE VIVIENDA

Entre los suscritos: de una parte, {{arrendadorNombre}}, dominicano(a), mayor de edad, portador(a) de la cédula de identidad y electoral / pasaporte No. {{arrendadorCedula}}, con domicilio en {{arrendadorDireccion}}, quien en lo adelante se denominará EL ARRENDADOR; y de la otra parte, {{arrendatarioNombre}}, dominicano(a), mayor de edad, portador(a) de la cédula de identidad y electoral / pasaporte No. {{arrendatarioCedula}}, quien en lo adelante se denominará EL ARRENDATARIO, se ha convenido y pactado libre y voluntariamente lo siguiente:

PRIMERA: OBJETO. EL ARRENDADOR da en alquiler a EL ARRENDATARIO, quien acepta, el inmueble ubicado en: {{direccionInmueble}}, para ser destinado exclusivamente a: {{usoInmueble}}.

SEGUNDA: CANON Y FORMA DE PAGO. El canon de alquiler mensual es de RD$ {{canonMensual}}, que EL ARRENDATARIO se obliga a pagar a EL ARRENDADOR {{diaPago}}, en el lugar y la forma que las partes acuerden.

TERCERA: DEPÓSITO DE GARANTÍA. EL ARRENDATARIO entrega a EL ARRENDADOR, en este acto, la suma de RD$ {{depositoGarantia}} en calidad de depósito de garantía, la cual será devuelta a la terminación del presente contrato, previa verificación del estado del inmueble y del cumplimiento de las obligaciones aquí contraídas, y podrá ser aplicada a cualquier deuda pendiente por concepto de alquileres, daños o servicios.

CUARTA: DURACIÓN. El presente contrato tendrá una duración de {{duracionMeses}} mes(es), contados a partir del {{fechaInicio}}, pudiendo ser renovado por acuerdo escrito entre las partes.

QUINTA: OBLIGACIONES DEL ARRENDATARIO. EL ARRENDATARIO se compromete a: (a) dar al inmueble el uso convenido; (b) mantenerlo en buen estado de conservación y limpieza; (c) no subarrendarlo total ni parcialmente sin autorización escrita de EL ARRENDADOR; (d) cubrir puntualmente los servicios de energía eléctrica, agua e internet que se generen durante la vigencia del contrato, salvo pacto distinto; y (e) devolver el inmueble en las mismas condiciones en que lo recibió, salvo el desgaste normal por el uso.

SEXTA: OBLIGACIONES DEL ARRENDADOR. EL ARRENDADOR se compromete a entregar el inmueble en condiciones habitables y a realizar, por su cuenta, las reparaciones mayores que no sean atribuibles al mal uso por parte de EL ARRENDATARIO.

SÉPTIMA: LEY APLICABLE. El presente contrato se rige por las leyes de la República Dominicana en materia de alquileres, particularmente la Ley No. 4314 sobre Control de Alquileres de Casas y Desahucios y sus disposiciones complementarias.

Hecho y firmado de buena fe, en dos (2) originales de un mismo tenor y efecto, uno para cada parte, en {{lugarFirma}}, el día {{fecha}}.


_______________________________          _______________________________
{{arrendadorNombre}}                      {{arrendatarioNombre}}
EL ARRENDADOR                             EL ARRENDATARIO`,
  },

  {
    clave: 'poder_especial',
    nombre: 'Poder Especial de Representación',
    descripcion: 'Autorización a una persona para representar a otra en una gestión específica.',
    precio: 800,
    campos: [
      { clave: 'poderdanteNombre', etiqueta: 'Nombre completo de quien otorga el poder', tipo: 'texto', requerido: true },
      { clave: 'poderdanteCedula', etiqueta: 'Cédula o pasaporte del poderdante', tipo: 'texto', requerido: true },
      { clave: 'poderdanteDireccion', etiqueta: 'Dirección del poderdante', tipo: 'texto', requerido: true },
      { clave: 'apoderadoNombre', etiqueta: 'Nombre completo de quien recibe el poder (apoderado)', tipo: 'texto', requerido: true },
      { clave: 'apoderadoCedula', etiqueta: 'Cédula o pasaporte del apoderado', tipo: 'texto', requerido: true },
      {
        clave: 'objetoPoder',
        etiqueta: 'Gestión específica para la que se otorga el poder',
        tipo: 'textarea',
        requerido: true,
        ayuda: 'Ej. representar al poderdante ante la Junta Central Electoral para retirar un acta de nacimiento',
      },
      {
        clave: 'facultadesEspecificas',
        etiqueta: 'Facultades específicas que se otorgan',
        tipo: 'textarea',
        requerido: true,
        ayuda: 'Ej. firmar solicitudes, recibir documentos, pagar tasas, recibir pagos, etc.',
      },
      { clave: 'lugarFirma', etiqueta: 'Lugar de la firma', tipo: 'texto', requerido: true },
      { clave: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true },
    ],
    cuerpo: `PODER ESPECIAL DE REPRESENTACIÓN

Yo, {{poderdanteNombre}}, dominicano(a), mayor de edad, portador(a) de la cédula de identidad y electoral / pasaporte No. {{poderdanteCedula}}, con domicilio en {{poderdanteDireccion}}, por medio del presente documento confiero PODER ESPECIAL, amplio y suficiente cuanto en derecho fuere necesario, a favor de {{apoderadoNombre}}, portador(a) de la cédula de identidad y electoral / pasaporte No. {{apoderadoCedula}}, para que en mi nombre y representación realice la siguiente gestión:

{{objetoPoder}}

Para el cumplimiento de este mandato, mi apoderado(a) queda facultado(a) expresamente para: {{facultadesEspecificas}}.

El presente poder es de carácter especial, limitado exclusivamente a la gestión antes descrita, y no autoriza a mi apoderado(a) a realizar ningún otro acto que no esté comprendido en los términos aquí expresados. Mi apoderado(a) queda obligado(a) a rendirme cuentas del cumplimiento de este mandato.

El presente poder podrá ser revocado en cualquier momento mediante comunicación escrita dirigida a mi apoderado(a) y, en su caso, a los terceros ante quienes se haya hecho valer.

Hecho y firmado en {{lugarFirma}}, el día {{fecha}}.


_______________________________
{{poderdanteNombre}}
EL PODERDANTE

Acepto el poder que antecede, en los términos en que ha sido conferido:


_______________________________
{{apoderadoNombre}}
EL APODERADO`,
  },

  {
    clave: 'prestacion_servicios',
    nombre: 'Contrato de Prestación de Servicios Profesionales',
    descripcion: 'Contratación de un servicio profesional entre un prestador y un cliente.',
    precio: 1500,
    campos: [
      { clave: 'prestadorNombre', etiqueta: 'Nombre o razón social del prestador del servicio', tipo: 'texto', requerido: true },
      { clave: 'prestadorIdentificacion', etiqueta: 'Cédula, pasaporte o RNC del prestador', tipo: 'texto', requerido: true },
      { clave: 'prestadorDireccion', etiqueta: 'Dirección del prestador', tipo: 'texto', requerido: true },
      { clave: 'clienteNombre', etiqueta: 'Nombre o razón social del cliente', tipo: 'texto', requerido: true },
      { clave: 'clienteIdentificacion', etiqueta: 'Cédula, pasaporte o RNC del cliente', tipo: 'texto', requerido: true },
      { clave: 'descripcionServicios', etiqueta: 'Descripción de los servicios a prestar', tipo: 'textarea', requerido: true },
      { clave: 'honorarios', etiqueta: 'Honorarios acordados (RD$)', tipo: 'numero', requerido: true },
      { clave: 'formaPago', etiqueta: 'Forma de pago', tipo: 'texto', requerido: true, ayuda: 'Ej. 50% de avance y 50% contra entrega' },
      { clave: 'plazoEjecucion', etiqueta: 'Plazo de ejecución', tipo: 'texto', requerido: true, ayuda: 'Ej. 30 días calendario a partir de la firma' },
      { clave: 'lugarFirma', etiqueta: 'Lugar de la firma', tipo: 'texto', requerido: true },
      { clave: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true },
    ],
    cuerpo: `CONTRATO DE PRESTACIÓN DE SERVICIOS PROFESIONALES

Entre los suscritos: de una parte, {{prestadorNombre}}, identificado(a) con cédula, pasaporte o RNC No. {{prestadorIdentificacion}}, con domicilio en {{prestadorDireccion}}, quien en lo adelante se denominará EL PRESTADOR; y de la otra parte, {{clienteNombre}}, identificado(a) con cédula, pasaporte o RNC No. {{clienteIdentificacion}}, quien en lo adelante se denominará EL CLIENTE, se ha convenido y pactado libre y voluntariamente lo siguiente:

PRIMERA: OBJETO. EL PRESTADOR se compromete a brindar a EL CLIENTE los siguientes servicios profesionales:

{{descripcionServicios}}

SEGUNDA: HONORARIOS Y FORMA DE PAGO. Como contraprestación por los servicios descritos, EL CLIENTE pagará a EL PRESTADOR la suma de RD$ {{honorarios}}, de la siguiente forma: {{formaPago}}.

TERCERA: PLAZO DE EJECUCIÓN. EL PRESTADOR se compromete a ejecutar los servicios contratados en el siguiente plazo: {{plazoEjecucion}}, salvo causas de fuerza mayor o caso fortuito debidamente justificadas.

CUARTA: NATURALEZA DE LA RELACIÓN. Las partes reconocen que el presente contrato es de naturaleza civil y no genera relación de subordinación ni vínculo de carácter laboral entre EL PRESTADOR y EL CLIENTE, conservando EL PRESTADOR plena autonomía técnica en la ejecución de los servicios.

QUINTA: CONFIDENCIALIDAD. Ambas partes se obligan a mantener confidencialidad respecto de la información que se compartan con motivo de la ejecución de este contrato, salvo que su divulgación sea requerida por ley o autoridad competente.

SEXTA: LEY APLICABLE. El presente contrato se rige por las leyes de la República Dominicana.

Hecho y firmado de buena fe, en dos (2) originales de un mismo tenor y efecto, uno para cada parte, en {{lugarFirma}}, el día {{fecha}}.


_______________________________          _______________________________
{{prestadorNombre}}                       {{clienteNombre}}
EL PRESTADOR                              EL CLIENTE`,
  },

  {
    clave: 'confidencialidad_nda',
    nombre: 'Acuerdo de Confidencialidad (NDA)',
    descripcion: 'Compromiso de confidencialidad entre dos partes que compartirán información sensible.',
    precio: 700,
    campos: [
      { clave: 'primeraParteNombre', etiqueta: 'Nombre o razón social de la primera parte', tipo: 'texto', requerido: true },
      { clave: 'primeraParteIdentificacion', etiqueta: 'Cédula, pasaporte o RNC de la primera parte', tipo: 'texto', requerido: true },
      { clave: 'segundaParteNombre', etiqueta: 'Nombre o razón social de la segunda parte', tipo: 'texto', requerido: true },
      { clave: 'segundaParteIdentificacion', etiqueta: 'Cédula, pasaporte o RNC de la segunda parte', tipo: 'texto', requerido: true },
      {
        clave: 'propositoAcuerdo',
        etiqueta: 'Propósito por el cual se comparte la información',
        tipo: 'textarea',
        requerido: true,
        ayuda: 'Ej. evaluar una posible relación comercial entre las partes',
      },
      { clave: 'duracionAnios', etiqueta: 'Duración de la obligación de confidencialidad (años)', tipo: 'numero', requerido: true },
      { clave: 'lugarFirma', etiqueta: 'Lugar de la firma', tipo: 'texto', requerido: true },
      { clave: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true },
    ],
    cuerpo: `ACUERDO DE CONFIDENCIALIDAD

Entre los suscritos: de una parte, {{primeraParteNombre}}, identificado(a) con cédula, pasaporte o RNC No. {{primeraParteIdentificacion}}; y de la otra parte, {{segundaParteNombre}}, identificado(a) con cédula, pasaporte o RNC No. {{segundaParteIdentificacion}}, denominados en lo adelante conjuntamente LAS PARTES, se ha convenido y pactado libre y voluntariamente lo siguiente:

PRIMERA: OBJETO. LAS PARTES sostendrán intercambios de información con el siguiente propósito: {{propositoAcuerdo}}. Con motivo de dicho intercambio, LAS PARTES podrán tener acceso a información confidencial de la otra parte, por lo que acuerdan sujetarse a las condiciones establecidas en el presente documento.

SEGUNDA: DEFINICIÓN DE INFORMACIÓN CONFIDENCIAL. Se considera información confidencial toda información técnica, comercial, financiera, legal o de cualquier otra naturaleza, escrita, oral o de cualquier otro formato, que una parte revele a la otra con motivo del propósito descrito en la cláusula PRIMERA, y que razonablemente deba considerarse de carácter reservado.

TERCERA: OBLIGACIONES. LAS PARTES se comprometen a: (a) mantener en estricta reserva la información confidencial recibida; (b) no divulgarla a terceros sin autorización previa y escrita de la parte reveladora; (c) utilizarla exclusivamente para el propósito descrito en la cláusula PRIMERA; y (d) adoptar las medidas razonables para protegerla, con el mismo cuidado que emplean para proteger su propia información confidencial.

CUARTA: EXCEPCIONES. Las obligaciones anteriores no aplican a información que: (a) sea o llegue a ser de dominio público sin culpa de la parte receptora; (b) ya estuviera en posesión de la parte receptora antes de su divulgación; o (c) deba ser divulgada por mandato de ley o de autoridad competente.

QUINTA: DURACIÓN. Las obligaciones de confidencialidad establecidas en este acuerdo permanecerán vigentes durante {{duracionAnios}} año(s) contados a partir de la fecha de su firma, incluso si la relación entre LAS PARTES termina antes de dicho plazo.

SEXTA: LEY APLICABLE. El presente acuerdo se rige por las leyes de la República Dominicana.

Hecho y firmado de buena fe, en dos (2) originales de un mismo tenor y efecto, uno para cada parte, en {{lugarFirma}}, el día {{fecha}}.


_______________________________          _______________________________
{{primeraParteNombre}}                    {{segundaParteNombre}}
PRIMERA PARTE                             SEGUNDA PARTE`,
  },
];

export function obtenerPlantilla(clave: string): PlantillaDocumento | undefined {
  return CATALOGO_PLANTILLAS.find((p) => p.clave === clave);
}

/** Devuelve las etiquetas de los campos obligatorios que aún no tienen valor. */
export function camposFaltantes(plantilla: PlantillaDocumento, datos: Record<string, string>): string[] {
  return plantilla.campos
    .filter((c) => c.requerido && !String(datos?.[c.clave] ?? '').trim())
    .map((c) => c.etiqueta);
}

/**
 * Reemplaza cada {{clave}} del cuerpo de la plantilla por el valor
 * correspondiente en `datos`. Si un campo no tiene valor (no debería pasar
 * en el documento final, ya que se valida con camposFaltantes antes de
 * aprobar), se deja un marcador visible entre corchetes en vez de dejar el
 * {{clave}} crudo.
 */
export function renderizarCuerpo(plantilla: PlantillaDocumento, datos: Record<string, string>): string {
  let texto = plantilla.cuerpo;
  for (const campo of plantilla.campos) {
    const valor = String(datos?.[campo.clave] ?? '').trim() || `[${campo.etiqueta}]`;
    texto = texto.split(`{{${campo.clave}}}`).join(valor);
  }
  return texto;
}
