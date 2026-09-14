import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { randomBytes, randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { SolicitudDocumento } from './solicitud-documento.entity.js';
import { Documento } from '../documentos/documento.entity.js';
import { Cliente } from '../clientes/cliente.entity.js';
import { AlmacenamientoService } from '../documentos/almacenamiento.service.js';
import { CrearSolicitudDocumentoDto } from './dto/crear-solicitud.dto.js';
import { CompletarSolicitudDto } from './dto/completar-solicitud.dto.js';
import { RevisarSolicitudDocumentoDto } from './dto/revisar-solicitud.dto.js';
import { ConfirmarPagoDto } from './dto/confirmar-pago.dto.js';
import { IniciarSolicitudPublicaDto } from './dto/iniciar-solicitud-publica.dto.js';
import {
  CATALOGO_PLANTILLAS,
  obtenerPlantilla,
  camposFaltantes,
  renderizarCuerpo,
} from './plantillas-catalogo.js';
import { PlantillaPdfService } from './pdf/plantilla-pdf.service.js';
import { EstadoSolicitudDocumento, CategoriaDocumento, TipoCliente } from '../common/enums/index.js';
import { MARCA_CORPORATIVA, CUENTAS_BANCARIAS } from '../common/constants/marca-corporativa.js';

@Injectable()
export class PlantillasService {
  constructor(
    @InjectRepository(SolicitudDocumento)
    private readonly solicitudRepo: Repository<SolicitudDocumento>,
    @InjectRepository(Documento)
    private readonly documentoRepo: Repository<Documento>,
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
    private readonly pdfService: PlantillaPdfService,
    private readonly config: ConfigService,
    private readonly almacenamientoService: AlmacenamientoService,
  ) {}

  /**
   * `soloPublico=true` filtra las plantillas marcadas
   * `visibleEnCatalogoPublico: false` (instancias/escritos internos que no
   * se venden al público) -- lo usa el catálogo público de autoservicio.
   * La pantalla interna (PlantillasCatalogoController) sigue viendo todo.
   */
  listarCatalogo(soloPublico = false) {
    return CATALOGO_PLANTILLAS.filter((p) => !soloPublico || p.visibleEnCatalogoPublico !== false).map(
      ({ clave, nombre, descripcion, precio, campos, requiereVerificacionCitas, visibleEnCatalogoPublico }) => ({
        clave,
        nombre,
        descripcion,
        precio,
        campos,
        requiereVerificacionCitas,
        visibleEnCatalogoPublico: visibleEnCatalogoPublico !== false,
      }),
    );
  }

  /** Datos de pago -- cuentas bancarias y contacto -- para mostrar al cliente. */
  private datosPago() {
    return { cuentas: CUENTAS_BANCARIAS, telefono: MARCA_CORPORATIVA.telefono };
  }

  private generarToken(): string {
    return randomBytes(24).toString('base64url');
  }

  private construirEnlacePublico(token: string): string {
    const base = (process.env.FRONTEND_URL ?? 'http://localhost:5173').split(',')[0].trim();
    return `${base}/firmar/${token}`;
  }

  async crear(dto: CrearSolicitudDocumentoDto, usuarioId: string) {
    const plantilla = obtenerPlantilla(dto.plantillaClave);
    if (!plantilla) throw new BadRequestException('Plantilla no encontrada');

    if (dto.clienteId) {
      const existe = await this.clienteRepo.findOne({ where: { id: dto.clienteId } });
      if (!existe) throw new BadRequestException('El cliente indicado no existe');
    }

    const datos = dto.datosPrellenados ?? {};
    // Si quien crea la solicitud ya dejó todos los campos obligatorios
    // llenos (típico de una instancia/escrito que redacta el propio
    // despacho, sin que ningún cliente tenga que completar un formulario),
    // se salta el paso de "esperar al cliente" y pasa directo a revisión
    // interna -- pendiente_cliente solo tiene sentido cuando falta algo.
    const completaDesdeElInicio = camposFaltantes(plantilla, datos).length === 0;

    const solicitud = this.solicitudRepo.create({
      plantillaClave: dto.plantillaClave,
      expedienteId: dto.expedienteId,
      clienteId: dto.clienteId,
      datos,
      notasInternas: dto.notasInternas,
      tokenAcceso: this.generarToken(),
      creadoPorId: usuarioId,
      precio: plantilla.precio.toFixed(2),
      estado: completaDesdeElInicio ? EstadoSolicitudDocumento.PENDIENTE_APROBACION : EstadoSolicitudDocumento.PENDIENTE_CLIENTE,
      completadoEn: completaDesdeElInicio ? new Date() : undefined,
    });
    const guardada = await this.solicitudRepo.save(solicitud);
    return { solicitud: guardada, enlacePublico: this.construirEnlacePublico(guardada.tokenAcceso) };
  }

  /**
   * Autoservicio público: cualquiera puede iniciar una solicitud desde el
   * catálogo público (sin que el despacho la cree primero), eligiendo solo
   * la plantilla. Sin cliente/expediente vinculado ni notas -- eso se puede
   * completar después desde la pantalla interna si hace falta.
   */
  async iniciarPublico(dto: IniciarSolicitudPublicaDto): Promise<{ tokenAcceso: string }> {
    const plantilla = obtenerPlantilla(dto.plantillaClave);
    if (!plantilla) throw new BadRequestException('Plantilla no encontrada');

    const solicitud = this.solicitudRepo.create({
      plantillaClave: dto.plantillaClave,
      datos: {},
      tokenAcceso: this.generarToken(),
      precio: plantilla.precio.toFixed(2),
    });
    const guardada = await this.solicitudRepo.save(solicitud);
    return { tokenAcceso: guardada.tokenAcceso };
  }

  async listar(filtros: { estado?: string; expedienteId?: string; clienteId?: string }) {
    const where: Record<string, string> = {};
    if (filtros.estado) where.estado = filtros.estado;
    if (filtros.expedienteId) where.expedienteId = filtros.expedienteId;
    if (filtros.clienteId) where.clienteId = filtros.clienteId;
    return this.solicitudRepo.find({ where, order: { creadoEn: 'DESC' } });
  }

  async obtener(id: string): Promise<SolicitudDocumento> {
    const solicitud = await this.solicitudRepo.findOne({ where: { id } });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');
    return solicitud;
  }

  async obtenerConPlantilla(id: string) {
    const solicitud = await this.obtener(id);
    const plantilla = obtenerPlantilla(solicitud.plantillaClave);
    return {
      solicitud,
      plantilla,
      enlacePublico: this.construirEnlacePublico(solicitud.tokenAcceso),
    };
  }

  // --- Acceso público (sin autenticación), vía token -----------------

  async obtenerPorToken(token: string) {
    const solicitud = await this.solicitudRepo.findOne({ where: { tokenAcceso: token } });
    if (!solicitud) throw new NotFoundException('Enlace no válido o expirado');
    const plantilla = obtenerPlantilla(solicitud.plantillaClave);
    if (!plantilla) throw new NotFoundException('Enlace no válido o expirado');

    return {
      plantilla: { nombre: plantilla.nombre, descripcion: plantilla.descripcion, campos: plantilla.campos },
      datos: solicitud.datos,
      estado: solicitud.estado,
      precio: Number(solicitud.precio),
      pagoConfirmado: solicitud.pagoConfirmado,
      pago: Number(solicitud.precio) > 0 ? this.datosPago() : undefined,
      motivoRechazo:
        solicitud.estado === EstadoSolicitudDocumento.PENDIENTE_CLIENTE ? solicitud.motivoRechazo : undefined,
    };
  }

  async completarPorToken(token: string, dto: CompletarSolicitudDto) {
    const solicitud = await this.solicitudRepo.findOne({ where: { tokenAcceso: token } });
    if (!solicitud) throw new NotFoundException('Enlace no válido o expirado');
    if (solicitud.estado !== EstadoSolicitudDocumento.PENDIENTE_CLIENTE) {
      throw new BadRequestException('Este documento ya fue enviado y está en revisión, o ya fue aprobado.');
    }
    const plantilla = obtenerPlantilla(solicitud.plantillaClave);
    if (!plantilla) throw new NotFoundException('Enlace no válido o expirado');

    // Endurecimiento de seguridad (auditoría 14-sep-2026): este endpoint es
    // público (sin JWT) -- 'dto.datos' es un objeto libre que llega
    // directo de un desconocido en internet. Antes de fusionarlo, se
    // descarta cualquier clave que no esté declarada en los campos de la
    // plantilla y se limita el tamaño de cada valor, para que no se pueda
    // usar este formulario para inflar la base de datos ni inyectar datos
    // arbitrarios fuera de lo que el formulario realmente pide.
    const datosSaneados = this.sanitizarDatosPublicos(plantilla, dto.datos);
    const datosFinales = { ...solicitud.datos, ...datosSaneados };
    const faltantes = camposFaltantes(plantilla, datosFinales);
    if (faltantes.length > 0) {
      throw new BadRequestException(`Faltan campos obligatorios: ${faltantes.join(', ')}`);
    }

    solicitud.datos = datosFinales;
    solicitud.estado = EstadoSolicitudDocumento.PENDIENTE_APROBACION;
    solicitud.completadoEn = new Date();
    solicitud.motivoRechazo = null;
    await this.solicitudRepo.save(solicitud);
    return { recibido: true };
  }

  // --- Revisión interna ------------------------------------------------

  async revisar(id: string, dto: RevisarSolicitudDocumentoDto, usuarioId: string): Promise<SolicitudDocumento> {
    const solicitud = await this.obtener(id);
    const plantillaPrevia = obtenerPlantilla(solicitud.plantillaClave);
    // Una plantilla de uso interno (visibleEnCatalogoPublico=false, ej. una
    // instancia) nunca pasa por el flujo de "el cliente la completa" -- el
    // propio despacho la llena de principio a fin -- así que también se
    // puede revisar/aprobar estando en pendiente_cliente, no solo en
    // pendiente_aprobacion.
    const puedeRevisarse =
      solicitud.estado === EstadoSolicitudDocumento.PENDIENTE_APROBACION ||
      (solicitud.estado === EstadoSolicitudDocumento.PENDIENTE_CLIENTE && plantillaPrevia?.visibleEnCatalogoPublico === false);
    if (!puedeRevisarse) {
      throw new BadRequestException(
        'Solo se pueden revisar solicitudes que el cliente ya completó y están pendientes de aprobación.',
      );
    }
    const plantilla = obtenerPlantilla(solicitud.plantillaClave);
    if (!plantilla) throw new NotFoundException('Plantilla no encontrada');

    if (dto.datosCorregidos) {
      solicitud.datos = { ...solicitud.datos, ...dto.datosCorregidos };
      // Cualquier corrección de texto invalida una verificación de citas
      // ya hecha -- hay que confirmarla de nuevo sobre el texto final.
      if (plantilla.requiereVerificacionCitas) {
        solicitud.citasVerificadas = false;
        solicitud.citasVerificadasPorId = undefined;
        solicitud.citasVerificadasEn = undefined;
      }
    }

    if (!dto.aprobar) {
      solicitud.estado = EstadoSolicitudDocumento.PENDIENTE_CLIENTE;
      solicitud.motivoRechazo =
        dto.motivoRechazo || 'Se solicitaron correcciones a este documento. Por favor revisa y vuelve a enviarlo.';
      solicitud.completadoEn = null;
      solicitud.revisadoEn = new Date();
      solicitud.revisadoPorId = usuarioId;
      return this.solicitudRepo.save(solicitud);
    }

    const faltantes = camposFaltantes(plantilla, solicitud.datos);
    if (faltantes.length > 0) {
      throw new BadRequestException(`No se puede aprobar: faltan campos obligatorios: ${faltantes.join(', ')}`);
    }
    if (Number(solicitud.precio) > 0 && !solicitud.pagoConfirmado) {
      throw new BadRequestException(
        'No se puede aprobar: el pago de este documento aún no ha sido confirmado. Marca el pago como recibido primero.',
      );
    }
    if (plantilla.requiereVerificacionCitas && !solicitud.citasVerificadas) {
      throw new BadRequestException(
        'No se puede aprobar: falta confirmar que se verificó que cada ley y jurisprudencia citada en este documento existe y es correcta. Usa "Confirmar citas verificadas" primero.',
      );
    }

    const cuerpo = renderizarCuerpo(plantilla, solicitud.datos);
    const buffer = await this.pdfService.generarDocumentoPdf(
      plantilla.nombre,
      cuerpo,
      plantilla.tamanoPagina,
      plantilla.incluirEspacioNotarial !== false,
    );

    const nombreArchivoDisco = `${randomUUID()}.pdf`;
    await this.almacenamientoService.subir(nombreArchivoDisco, buffer, 'application/pdf');

    const nombreCliente = await this.nombreClienteParaArchivo(solicitud.clienteId);
    const documento = this.documentoRepo.create({
      expedienteId: solicitud.expedienteId,
      clienteId: solicitud.clienteId,
      carpeta: 'Contratos generados',
      categoria: CategoriaDocumento.CONTRATOS,
      nombreArchivo: `${plantilla.nombre}${nombreCliente ? ' - ' + nombreCliente : ''}.pdf`,
      rutaAlmacenamiento: nombreArchivoDisco,
      tipoMime: 'application/pdf',
      tamanoBytes: buffer.length,
      version: 1,
      subidoPorId: usuarioId,
    });
    const documentoGuardado = await this.documentoRepo.save(documento);

    solicitud.estado = EstadoSolicitudDocumento.APROBADO;
    solicitud.documentoGeneradoId = documentoGuardado.id;
    solicitud.revisadoEn = new Date();
    solicitud.revisadoPorId = usuarioId;
    solicitud.motivoRechazo = null;
    return this.solicitudRepo.save(solicitud);
  }

  async confirmarPago(id: string, dto: ConfirmarPagoDto, usuarioId: string): Promise<SolicitudDocumento> {
    const solicitud = await this.obtener(id);
    if (
      solicitud.estado !== EstadoSolicitudDocumento.PENDIENTE_CLIENTE &&
      solicitud.estado !== EstadoSolicitudDocumento.PENDIENTE_APROBACION
    ) {
      throw new BadRequestException('Este documento ya fue aprobado -- no hace falta confirmar el pago de nuevo.');
    }
    solicitud.pagoConfirmado = true;
    solicitud.pagoConfirmadoEn = new Date();
    solicitud.pagoConfirmadoPorId = usuarioId;
    solicitud.referenciaPago = dto.referenciaPago;
    return this.solicitudRepo.save(solicitud);
  }

  private async nombreClienteParaArchivo(clienteId?: string): Promise<string | null> {
    if (!clienteId) return null;
    const cliente = await this.clienteRepo.findOne({ where: { id: clienteId } });
    if (!cliente) return null;
    return cliente.tipo === TipoCliente.JURIDICO
      ? (cliente.razonSocial ?? cliente.nombreComercial ?? '')
      : `${cliente.nombres ?? ''} ${cliente.apellidos ?? ''}`.trim();
  }

  // --- Edición interna de campos (instancias/escritos) ------------------

  /**
   * Deja que el personal interno vaya llenando/corrigiendo los campos de
   * una solicitud (ej. una instancia) antes de mandarla a revisión --
   * distinto del flujo de "el cliente completa su formulario público" que
   * usa completarPorToken. Solo mientras no esté ya aprobada o rechazada.
   */
  async actualizarDatos(id: string, datos: Record<string, string>, usuarioId: string): Promise<SolicitudDocumento> {
    const solicitud = await this.obtener(id);
    if (
      solicitud.estado === EstadoSolicitudDocumento.APROBADO
    ) {
      throw new BadRequestException('Este documento ya fue aprobado y no se puede editar.');
    }
    const plantilla = obtenerPlantilla(solicitud.plantillaClave);
    if (!plantilla) throw new NotFoundException('Plantilla no encontrada');

    solicitud.datos = { ...solicitud.datos, ...datos };
    // Igual que al corregir datos desde revisar(): cualquier edición
    // invalida una verificación de citas ya hecha.
    if (plantilla.requiereVerificacionCitas) {
      solicitud.citasVerificadas = false;
      solicitud.citasVerificadasPorId = undefined;
      solicitud.citasVerificadasEn = undefined;
    }
    // Plantillas de uso interno (instancias): una vez completos todos los
    // campos obligatorios, pasa a pendiente de aprobación -- no tiene
    // sentido dejarla en "pendiente_cliente" cuando no hay ningún cliente
    // llenando nada.
    if (
      plantilla.visibleEnCatalogoPublico === false &&
      solicitud.estado === EstadoSolicitudDocumento.PENDIENTE_CLIENTE &&
      camposFaltantes(plantilla, solicitud.datos).length === 0
    ) {
      solicitud.estado = EstadoSolicitudDocumento.PENDIENTE_APROBACION;
      solicitud.completadoEn = new Date();
    }
    return this.solicitudRepo.save(solicitud);
  }

  /**
   * Confirmación explícita de un humano de que verificó personalmente que
   * cada ley y jurisprudencia citada en el documento existe y es correcta.
   * Obligatoria (ver revisar()) antes de aprobar cualquier plantilla con
   * requiereVerificacionCitas=true.
   */
  async confirmarCitasVerificadas(id: string, usuarioId: string): Promise<SolicitudDocumento> {
    const solicitud = await this.obtener(id);
    if (solicitud.estado === EstadoSolicitudDocumento.APROBADO) {
      throw new BadRequestException('Este documento ya fue aprobado.');
    }
    solicitud.citasVerificadas = true;
    solicitud.citasVerificadasPorId = usuarioId;
    solicitud.citasVerificadasEn = new Date();
    return this.solicitudRepo.save(solicitud);
  }

  // --- Redacción asistida (IA) -------------------------------------------

  private clienteAnthropic(): Anthropic {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new BadRequestException(
        'La redacción asistida todavía no está activada: falta configurar la clave de Anthropic (ANTHROPIC_API_KEY) en el archivo .env del backend.',
      );
    }
    return new Anthropic({ apiKey });
  }

  /**
   * Genera un BORRADOR del fundamento de derecho (leyes y jurisprudencia
   * aplicable), a partir de los hechos que el abogado ya escribió. Es una
   * operación sin estado -- no necesita que la solicitud exista todavía,
   * para poder usarse directo desde el formulario de creación -- y no
   * guarda nada por sí sola: el abogado decide si pega el texto en el
   * campo correspondiente antes de enviar el formulario.
   *
   * ADVERTENCIA que se traslada también al usuario final: un modelo de
   * lenguaje puede inventar números de sentencia, resoluciones o artículos
   * que no existen. Por eso esta plantilla exige verificación humana
   * obligatoria (requiereVerificacionCitas) y nunca se debe tratar este
   * texto como listo para depositar sin comprobar cada cita en su fuente
   * original.
   */
  async generarFundamentoConIA(datos: { destinatario?: string; asunto?: string; hechos: string }): Promise<{ texto: string; advertencia: string }> {
    const hechos = String(datos.hechos ?? '').trim();
    if (!hechos) {
      throw new BadRequestException('Escribe primero los hechos antes de pedir un borrador de fundamento de derecho.');
    }

    const anthropic = this.clienteAnthropic();
    const mensaje = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1500,
      system:
        'Eres un asistente que ayuda a un abogado dominicano a redactar el apartado "EN CUANTO AL DERECHO" de una instancia o escrito motivado, dirigido a un tribunal o institución de la República Dominicana. ' +
        'Redacta en español jurídico dominicano, con tono formal. ' +
        'Regla más importante: NUNCA inventes un número de sentencia, resolución, expediente o cita textual que no conozcas con certeza. ' +
        'Si consideras que aplica una ley o jurisprudencia pero no estás seguro del número o fecha exacta, descríbela en términos generales (ej. "conforme a la jurisprudencia constante de la Suprema Corte de Justicia en materia de...") en vez de inventar un número. ' +
        'Este texto es un BORRADOR que el abogado va a revisar y verificar antes de usarlo -- nunca afirmes que una cita ya fue verificada.',
      messages: [
        {
          role: 'user',
          content:
            `Destinatario de la instancia: ${datos.destinatario || '(no indicado)'}
` +
            `Asunto: ${datos.asunto || '(no indicado)'}

` +
            `Hechos:
${hechos}

` +
            'Redacta únicamente el apartado de fundamento de derecho (leyes y jurisprudencia aplicable) correspondiente a estos hechos, listo para insertarse en el escrito. No incluyas el encabezado "EN CUANTO AL DERECHO", ni los hechos, ni la petición -- solo el fundamento.',
        },
      ],
    });

    const texto = mensaje.content
      .filter((bloque): bloque is Anthropic.TextBlock => bloque.type === 'text')
      .map((bloque) => bloque.text)
      .join('\n')
      .trim();

    return {
      texto,
      advertencia:
        'Borrador generado por IA -- verifica personalmente cada ley, artículo y sentencia citada antes de usarlo. No se puede aprobar este documento sin confirmar esa verificación.',
    };
  }
  // Filtra 'datos' entrantes de un endpoint publico a solo las claves
  // declaradas en la plantilla, forzando string y un tope de longitud
  // razonable por campo (los 'textarea' pueden ser mas largos que un
  // 'texto' simple).
  private sanitizarDatosPublicos(
    plantilla: { campos: { clave: string; tipo?: string }[] },
    datos: Record<string, unknown>,
  ): Record<string, string> {
    const clavesValidas = new Set(plantilla.campos.map((c) => c.clave));
    const resultado: Record<string, string> = {};
    for (const [clave, valor] of Object.entries(datos ?? {})) {
      if (!clavesValidas.has(clave)) continue;
      if (typeof valor !== 'string') continue;
      const campo = plantilla.campos.find((c) => c.clave === clave);
      const tope = campo?.tipo === 'textarea' ? 5000 : 500;
      resultado[clave] = valor.slice(0, tope);
    }
    return resultado;
  }
}
