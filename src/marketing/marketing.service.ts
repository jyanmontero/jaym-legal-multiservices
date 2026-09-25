import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { AnuncioPropiedad } from './anuncio-propiedad.entity.js';
import { AlmacenamientoService } from '../documentos/almacenamiento.service.js';
import { MetaGraphService } from './meta-graph.service.js';
import { WordpressPortalService } from './wordpress-portal.service.js';
import { CrearAnuncioDto } from './dto/crear-anuncio.dto.js';
import { ActualizarAnuncioDto } from './dto/actualizar-anuncio.dto.js';
import { EstadoAnuncioPropiedad } from '../common/enums/index.js';

export interface DatosPropiedadSugeridos {
  titulo?: string;
  zona?: string;
  habitaciones?: number;
  banos?: number;
  metrosCuadrados?: number;
  precio?: number;
  moneda?: string;
  notas?: string;
  contacto?: string;
}

interface DatosPropiedad {
  titulo: string;
  zona?: string;
  habitaciones?: number;
  banos?: number;
  metrosCuadrados?: number;
  precio: number;
  moneda: string;
  notas?: string;
  contacto?: string;
}

@Injectable()
export class MarketingService {
  constructor(
    @InjectRepository(AnuncioPropiedad)
    private readonly repo: Repository<AnuncioPropiedad>,
    private readonly config: ConfigService,
    private readonly almacenamiento: AlmacenamientoService,
    private readonly metaGraph: MetaGraphService,
    private readonly wordpressPortal: WordpressPortalService,
  ) {}

  private clienteAnthropic(): Anthropic {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new BadRequestException(
        'La redacción automática del anuncio no está activada: falta configurar ANTHROPIC_API_KEY.',
      );
    }
    return new Anthropic({ apiKey });
  }

  /** Genera el texto del anuncio (FB/IG) y el mensaje de WhatsApp con IA. Nunca se publica sin que un humano lo revise primero. */
  private async generarTextos(datos: DatosPropiedad): Promise<{ textoAnuncio: string; mensajeWhatsapp: string }> {
    const anthropic = this.clienteAnthropic();

    const resumenDatos = [
      `Título: ${datos.titulo}`,
      datos.zona && `Zona: ${datos.zona}`,
      datos.habitaciones != null && `Habitaciones: ${datos.habitaciones}`,
      datos.banos != null && `Baños: ${datos.banos}`,
      datos.metrosCuadrados != null && `Metros cuadrados: ${datos.metrosCuadrados} m²`,
      `Precio: ${datos.moneda}${Number(datos.precio).toLocaleString('es-DO')}`,
      datos.notas && `Notas adicionales: ${datos.notas}`,
      datos.contacto && `Forma de contacto a incluir: ${datos.contacto}`,
    ]
      .filter(Boolean)
      .join('\n');

    const herramienta: Anthropic.Tool = {
      name: 'registrar_anuncio_propiedad',
      description: 'Registra el texto del anuncio y el mensaje de WhatsApp para esta propiedad.',
      input_schema: {
        type: 'object',
        properties: {
          textoAnuncio: {
            type: 'string',
            description:
              'Texto para publicar en Facebook e Instagram: atractivo, breve (máximo ~120 palabras), con emojis moderados, que destaque ubicación/características/precio y termine con una llamada a la acción y la forma de contacto si se proporcionó.',
          },
          mensajeWhatsapp: {
            type: 'string',
            description:
              'Versión más corta y directa del mismo anuncio, lista para reenviar por WhatsApp a contactos o listas de difusión.',
          },
        },
        required: ['textoAnuncio', 'mensajeWhatsapp'],
      },
    };

    const respuesta = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      tools: [herramienta],
      tool_choice: { type: 'tool', name: 'registrar_anuncio_propiedad' },
      messages: [
        {
          role: 'user',
          content:
            'Eres el redactor de marketing de JAYM Portal Inmobiliario, un portal de bienes raíces en República Dominicana. ' +
            'Redacta el anuncio para esta propiedad, en español, dirigido al mercado dominicano. ' +
            'No inventes características que no se te dieron (no inventes piscina, garaje, etc. si no aparecen en los datos).\n\n' +
            resumenDatos,
        },
      ],
    });

    const bloque = respuesta.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'registrar_anuncio_propiedad',
    );
    if (!bloque) {
      throw new BadRequestException('La IA no devolvió el anuncio esperado. Intenta de nuevo.');
    }
    const entrada = bloque.input as { textoAnuncio: string; mensajeWhatsapp: string };
    return entrada;
  }

  /**
   * "Carga rápida": el usuario describe la propiedad con sus propias
   * palabras (escribiendo o dictando por voz en el navegador) y la IA
   * intenta extraer los campos del formulario. Es solo una sugerencia --
   * nunca crea ni guarda nada; el usuario siempre revisa y corrige antes
   * de generar el anuncio con el flujo normal (crear()).
   */
  async interpretarDescripcion(descripcion: string): Promise<DatosPropiedadSugeridos> {
    const anthropic = this.clienteAnthropic();

    const herramienta: Anthropic.Tool = {
      name: 'registrar_datos_propiedad',
      description: 'Registra los datos estructurados de la propiedad extraídos de la descripción libre.',
      input_schema: {
        type: 'object',
        properties: {
          titulo: {
            type: 'string',
            description:
              'Título breve y atractivo para el anuncio, ej. "Villa moderna en Los Ríos". Si la descripción no da para un título claro, propone uno breve basado en lo que sí se mencionó.',
          },
          zona: {
            type: 'string',
            description: 'Sector, ciudad o zona de la propiedad, tal como se mencionó. Omitir si no se menciona.',
          },
          habitaciones: {
            type: 'integer',
            description: 'Cantidad de habitaciones/dormitorios. Omitir si no se menciona.',
          },
          banos: { type: 'integer', description: 'Cantidad de baños. Omitir si no se menciona.' },
          metrosCuadrados: { type: 'number', description: 'Tamaño en metros cuadrados. Omitir si no se menciona.' },
          precio: {
            type: 'number',
            description: 'Precio como número, sin símbolo de moneda ni separadores de miles. Omitir si no se menciona.',
          },
          moneda: {
            type: 'string',
            enum: ['RD$', 'US$'],
            description: 'RD$ por defecto, o US$ si se mencionan dólares/USD explícitamente.',
          },
          notas: {
            type: 'string',
            description:
              'El resto de las características mencionadas que no encajan en los campos anteriores (acabados, amenidades, estado, etc.), redactado como notas breves.',
          },
          contacto: {
            type: 'string',
            description: 'Forma de contacto mencionada (teléfono, WhatsApp, nombre de agente), si se dijo alguna. Omitir si no se menciona.',
          },
        },
        required: [],
      },
    };

    const respuesta = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      tools: [herramienta],
      tool_choice: { type: 'tool', name: 'registrar_datos_propiedad' },
      messages: [
        {
          role: 'user',
          content:
            'Un agente de JAYM Portal Inmobiliario (República Dominicana) describió una propiedad con sus propias palabras, ' +
            'posiblemente dictada por voz mientras estaba en la propiedad. Extrae los datos estructurados que realmente se ' +
            'mencionan. No inventes ni asumas nada que no esté dicho -- si un dato no se menciona, omite ese campo por completo.\n\n' +
            `Descripción: "${descripcion}"`,
        },
      ],
    });

    const bloque = respuesta.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'registrar_datos_propiedad',
    );
    if (!bloque) {
      throw new BadRequestException(
        'La IA no pudo interpretar la descripción. Intenta de nuevo o completa el formulario a mano.',
      );
    }
    return bloque.input as DatosPropiedadSugeridos;
  }

  async crear(dto: CrearAnuncioDto, fotos: Express.Multer.File[], usuarioId: string): Promise<AnuncioPropiedad> {
    if (!fotos || fotos.length === 0) {
      throw new BadRequestException('Debes subir al menos una foto de la propiedad.');
    }
    if (fotos.length > 10) {
      throw new BadRequestException('Máximo 10 fotos por anuncio (límite de carrusel de Instagram).');
    }

    const idAnuncio = randomUUID();
    const claves: string[] = [];
    for (let i = 0; i < fotos.length; i++) {
      const foto = fotos[i];
      const clave = `marketing/propiedades/${idAnuncio}/foto-${i + 1}${extname(foto.originalname).toLowerCase() || '.jpg'}`;
      await this.almacenamiento.subir(clave, foto.buffer, foto.mimetype);
      claves.push(clave);
    }

    const datos: DatosPropiedad = {
      titulo: dto.titulo,
      zona: dto.zona,
      habitaciones: dto.habitaciones,
      banos: dto.banos,
      metrosCuadrados: dto.metrosCuadrados,
      precio: dto.precio,
      moneda: dto.moneda ?? 'RD$',
      notas: dto.notas,
      contacto: dto.contacto,
    };

    const textos = await this.generarTextos(datos);

    const anuncio = this.repo.create({
      id: idAnuncio,
      titulo: dto.titulo,
      zona: dto.zona,
      habitaciones: dto.habitaciones,
      banos: dto.banos,
      metrosCuadrados: dto.metrosCuadrados != null ? String(dto.metrosCuadrados) : undefined,
      precio: String(dto.precio),
      moneda: dto.moneda ?? 'RD$',
      notas: dto.notas,
      contacto: dto.contacto,
      fotosClaves: claves,
      textoAnuncio: textos.textoAnuncio,
      mensajeWhatsapp: textos.mensajeWhatsapp,
      estado: EstadoAnuncioPropiedad.BORRADOR,
      creadoPorId: usuarioId,
    });
    return this.repo.save(anuncio);
  }

  /** Vuelve a generar el texto con IA a partir de los datos ya guardados (por si Joseph quiere otra versión). */
  async regenerarTexto(id: string): Promise<AnuncioPropiedad> {
    const anuncio = await this.obtener(id);
    const textos = await this.generarTextos({
      titulo: anuncio.titulo,
      zona: anuncio.zona,
      habitaciones: anuncio.habitaciones,
      banos: anuncio.banos,
      metrosCuadrados: anuncio.metrosCuadrados != null ? Number(anuncio.metrosCuadrados) : undefined,
      precio: Number(anuncio.precio),
      moneda: anuncio.moneda,
      notas: anuncio.notas,
      contacto: anuncio.contacto,
    });
    anuncio.textoAnuncio = textos.textoAnuncio;
    anuncio.mensajeWhatsapp = textos.mensajeWhatsapp;
    return this.repo.save(anuncio);
  }

  async listar(estado?: EstadoAnuncioPropiedad): Promise<AnuncioPropiedad[]> {
    return this.repo.find({ where: estado ? { estado } : {}, order: { creadoEn: 'DESC' } });
  }

  async obtener(id: string): Promise<AnuncioPropiedad> {
    const anuncio = await this.repo.findOneBy({ id });
    if (!anuncio) throw new NotFoundException('Anuncio no encontrado');
    return anuncio;
  }

  async actualizar(id: string, dto: ActualizarAnuncioDto): Promise<AnuncioPropiedad> {
    const anuncio = await this.obtener(id);
    if (anuncio.estado === EstadoAnuncioPropiedad.PUBLICADO) {
      throw new BadRequestException('Este anuncio ya fue publicado y no se puede editar desde aquí.');
    }
    if (dto.titulo !== undefined) anuncio.titulo = dto.titulo;
    if (dto.zona !== undefined) anuncio.zona = dto.zona;
    if (dto.habitaciones !== undefined) anuncio.habitaciones = dto.habitaciones;
    if (dto.banos !== undefined) anuncio.banos = dto.banos;
    if (dto.metrosCuadrados !== undefined) anuncio.metrosCuadrados = String(dto.metrosCuadrados);
    if (dto.precio !== undefined) anuncio.precio = String(dto.precio);
    if (dto.moneda !== undefined) anuncio.moneda = dto.moneda;
    if (dto.notas !== undefined) anuncio.notas = dto.notas;
    if (dto.contacto !== undefined) anuncio.contacto = dto.contacto;
    if (dto.textoAnuncio !== undefined) anuncio.textoAnuncio = dto.textoAnuncio;
    if (dto.mensajeWhatsapp !== undefined) anuncio.mensajeWhatsapp = dto.mensajeWhatsapp;
    return this.repo.save(anuncio);
  }

  async eliminar(id: string): Promise<{ eliminado: true }> {
    const anuncio = await this.obtener(id);
    if (anuncio.estado === EstadoAnuncioPropiedad.PUBLICADO) {
      throw new BadRequestException('Este anuncio ya fue publicado; no se puede eliminar desde aquí.');
    }
    for (const clave of anuncio.fotosClaves) {
      await this.almacenamiento.eliminar(clave);
    }
    await this.repo.remove(anuncio);
    return { eliminado: true };
  }

  /** URLs firmadas de corta duración, solo para previsualizar las fotos en el frontend antes de publicar. */
  async urlsFotos(id: string): Promise<{ clave: string; url: string | null }[]> {
    const anuncio = await this.obtener(id);
    const resultados: { clave: string; url: string | null }[] = [];
    for (const clave of anuncio.fotosClaves) {
      const url = await this.almacenamiento.urlLecturaPublica(clave, 600);
      resultados.push({ clave, url });
    }
    return resultados;
  }

  credencialesMetaConfiguradas(): boolean {
    return this.metaGraph.credencialesConfiguradas();
  }

  /** Publica el anuncio en la Página de Facebook y la cuenta de Instagram configuradas. */
  async publicar(id: string): Promise<AnuncioPropiedad> {
    const anuncio = await this.obtener(id);
    if (anuncio.estado === EstadoAnuncioPropiedad.PUBLICADO) {
      throw new BadRequestException('Este anuncio ya fue publicado.');
    }
    if (!anuncio.textoAnuncio) {
      throw new BadRequestException('Falta el texto del anuncio.');
    }

    // URLs firmadas temporales (30 min) para que los servidores de Meta
    // puedan descargar cada foto -- nunca se hacen públicas de forma
    // permanente en el bucket.
    const urls: string[] = [];
    for (const clave of anuncio.fotosClaves) {
      const url = await this.almacenamiento.urlLecturaPublica(clave, 1800);
      if (!url) {
        throw new BadRequestException(
          'El almacenamiento de fotos no está configurado para producción (falta R2) -- no se puede publicar en redes sociales.',
        );
      }
      urls.push(url);
    }

    const facebookPostId = await this.metaGraph.publicarEnFacebook(urls, anuncio.textoAnuncio);
    const instagramMediaId = await this.metaGraph.publicarEnInstagram(urls, anuncio.textoAnuncio);

    anuncio.facebookPostId = facebookPostId;
    anuncio.instagramMediaId = instagramMediaId;
    anuncio.estado = EstadoAnuncioPropiedad.PUBLICADO;
    anuncio.publicadoEn = new Date();
    return this.repo.save(anuncio);
  }

  credencialesPortalConfiguradas(): boolean {
    return this.wordpressPortal.credencialesConfiguradas();
  }

  /**
   * Publica (o actualiza) el anuncio como una ficha real en JAYM Portal
   * Inmobiliario (jaymportalinmobiliario.com). Es independiente de
   * publicar() (Meta) -- un anuncio puede publicarse en el portal, en redes,
   * en ambos o en ninguno, en el orden que Joseph prefiera.
   *
   * Limitación conocida: WP Residence no expone por REST los campos propios
   * de la ficha (precio/habitaciones/baños/metros/dirección/latitud/longitud
   * como campos estructurados) a menos que se registren con
   * `register_post_meta` en el tema hijo -- ver comentario en
   * wordpress-portal.service.ts. Mientras tanto, esos datos siempre se
   * incluyen en el texto de la ficha para que nunca quede incompleta de cara
   * al público.
   *
   * Auditoría 2026-09-25: se agregó aquí (a) inferencia de la categoría del
   * inmueble (property_category) con la misma heurística de texto que ya se
   * usaba para venta/renta, y (b) geocodificación de la zona para que el
   * mapa muestre la ubicación real. El adjuntar todas las fotos a la galería
   * (no solo la destacada) se resolvió dentro de publicarPropiedad().
   */
  async publicarEnPortal(id: string): Promise<AnuncioPropiedad> {
    const anuncio = await this.obtener(id);
    if (anuncio.fotosClaves.length === 0) {
      throw new BadRequestException('El anuncio no tiene fotos.');
    }

    // El modelo del anuncio (pensado originalmente solo para Meta) no
    // distingue venta/renta -- se infiere de las notas/título con una
    // heurística simple. Si Joseph nota que queda mal clasificado, puede
    // agregarlo a las notas explícitamente ("en renta"/"en alquiler").
    const textoBusquedaTipo = `${anuncio.titulo} ${anuncio.notas ?? ''}`.toLowerCase();
    const esRenta = /\balquiler|\brenta\b|\ben renta\b|\bfor rent\b/.test(textoBusquedaTipo);
    const idAccion = await this.wordpressPortal.buscarOCrearTermino(
      'property_action_category',
      esRenta ? 'En Renta' : 'En Venta',
    );

    const idCategoriaZona = anuncio.zona
      ? await this.wordpressPortal.buscarOCrearTermino('property_city', anuncio.zona)
      : undefined;

    // Categoría del inmueble (Casa/Apartamento/Condominio/Comercial) -- el
    // modelo tampoco distingue esto explícitamente, así que se infiere con
    // la misma heurística de texto que ya se usa para venta/renta arriba.
    // Los nombres deben coincidir exactamente con los términos reales que ya
    // existen en la taxonomía property_category del portal (confirmado por
    // consulta directa a /wp-json/wp/v2/property_category) para no crear
    // categorías duplicadas.
    let nombreCategoriaPropiedad = 'Casa unifamiliar';
    if (/\bapartamentos?\b|\baptos?\b/.test(textoBusquedaTipo)) {
      nombreCategoriaPropiedad = 'Apartamentos';
    } else if (/\bcondominios?\b|\bcondo\b/.test(textoBusquedaTipo)) {
      nombreCategoriaPropiedad = 'Condominios';
    } else if (/\bcomercial\b|\blocal comercial\b|\boficina\b|\bnegocio\b/.test(textoBusquedaTipo)) {
      nombreCategoriaPropiedad = 'Comercial';
    }
    const idCategoriaPropiedad = await this.wordpressPortal.buscarOCrearTermino(
      'property_category',
      nombreCategoriaPropiedad,
    );

    // Geocodificación (Nominatim/OpenStreetMap, gratis) -- resuelve la zona a
    // coordenadas reales para que el mapa de la ficha no muestre el demo del
    // tema (Denver, CO). Si no hay zona o el servicio falla, sigue sin
    // coordenadas nuevas -- nunca bloquea la publicación.
    const geo = anuncio.zona ? await this.wordpressPortal.geocodificarDireccion(anuncio.zona) : null;

    const idsFotos: number[] = [];
    for (let i = 0; i < anuncio.fotosClaves.length; i++) {
      const clave = anuncio.fotosClaves[i];
      const url = await this.almacenamiento.urlLecturaPublica(clave, 1800);
      if (!url) {
        throw new BadRequestException(
          'El almacenamiento de fotos no está configurado para producción (falta R2) -- no se puede publicar en el portal.',
        );
      }
      const nombreArchivo = clave.split('/').pop() ?? `foto-${i + 1}.jpg`;
      const tipoMime = nombreArchivo.toLowerCase().endsWith('.png')
        ? 'image/png'
        : nombreArchivo.toLowerCase().endsWith('.webp')
          ? 'image/webp'
          : 'image/jpeg';
      const idMedia = await this.wordpressPortal.subirFoto(url, nombreArchivo, tipoMime);
      idsFotos.push(idMedia);
    }

    const precioFormateado = `${anuncio.moneda}${Number(anuncio.precio).toLocaleString('es-DO')}`;
    const detalles = [
      `<strong>Precio:</strong> ${precioFormateado}`,
      anuncio.zona && `<strong>Zona:</strong> ${anuncio.zona}`,
      anuncio.habitaciones != null && `<strong>Habitaciones:</strong> ${anuncio.habitaciones}`,
      anuncio.banos != null && `<strong>Baños:</strong> ${anuncio.banos}`,
      anuncio.metrosCuadrados != null && `<strong>Metros cuadrados:</strong> ${anuncio.metrosCuadrados} m²`,
      anuncio.contacto && `<strong>Contacto:</strong> ${anuncio.contacto}`,
    ]
      .filter(Boolean)
      .join('<br>');
    const contenidoHtml = [
      anuncio.textoAnuncio ? `<p>${anuncio.textoAnuncio.replace(/\n/g, '<br>')}</p>` : '',
      `<p>${detalles}</p>`,
      anuncio.notas ? `<p>${anuncio.notas.replace(/\n/g, '<br>')}</p>` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const resultado = await this.wordpressPortal.publicarPropiedad({
      postIdExistente: anuncio.wordpressPostId,
      titulo: anuncio.titulo,
      contenidoHtml,
      idsFotos,
      idCategoriaZona,
      idCategoriaPropiedad,
      idAccion,
      precio: Number(anuncio.precio),
      habitaciones: anuncio.habitaciones,
      banos: anuncio.banos,
      metrosCuadrados: anuncio.metrosCuadrados != null ? Number(anuncio.metrosCuadrados) : undefined,
      direccion: anuncio.zona,
      latitud: geo?.lat,
      longitud: geo?.lon,
    });

    anuncio.wordpressPostId = resultado.id;
    anuncio.wordpressEnlace = resultado.enlace;
    return this.repo.save(anuncio);
  }
}
