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
import { CrearAnuncioDto } from './dto/crear-anuncio.dto.js';
import { ActualizarAnuncioDto } from './dto/actualizar-anuncio.dto.js';
import { EstadoAnuncioPropiedad } from '../common/enums/index.js';

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
}
