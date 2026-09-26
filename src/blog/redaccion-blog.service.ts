import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { MateriaJuridica } from '../common/enums/index.js';
import { MARCA_CORPORATIVA, ABOGADO_RESPONSABLE } from '../common/constants/marca-corporativa.js';

const MODELO = 'claude-sonnet-5';

const ETIQUETAS_AREA: Record<MateriaJuridica, string> = {
  [MateriaJuridica.CIVIL]: 'Derecho Civil',
  [MateriaJuridica.COMERCIAL]: 'Derecho Comercial',
  [MateriaJuridica.PENAL]: 'Derecho Penal',
  [MateriaJuridica.LABORAL]: 'Derecho Laboral',
  [MateriaJuridica.FAMILIA]: 'Derecho de Familia',
  [MateriaJuridica.INMOBILIARIO]: 'Derecho Inmobiliario',
  [MateriaJuridica.MIGRATORIO]: 'Derecho Migratorio',
  [MateriaJuridica.ADMINISTRATIVO]: 'Derecho Administrativo',
  [MateriaJuridica.CONSTITUCIONAL]: 'Derecho Constitucional',
  [MateriaJuridica.REGISTRO_CIVIL_JCE]: 'Registro Civil y JCE',
  [MateriaJuridica.NOTARIAL]: 'Derecho Notarial',
  [MateriaJuridica.CORPORATIVO]: 'Derecho Corporativo',
  [MateriaJuridica.PROPIEDAD_INTELECTUAL]: 'Propiedad Intelectual',
  [MateriaJuridica.COBROS]: 'Cobros',
  [MateriaJuridica.PROTECCION_CONSUMIDOR]: 'Protección al Consumidor',
  [MateriaJuridica.SEGURIDAD_SOCIAL]: 'Seguridad Social',
  [MateriaJuridica.OTRA]: 'otras materias',
};

export interface BorradorBlogGenerado {
  titulo: string;
  contenidoHtml: string;
  extracto: string;
  advertencia: string;
}

/**
 * Redacta borradores de blog para jaymlegalmultiservices.com a partir de un
 * tema o palabra clave (sección "Etapa 4: automatización" / hallazgo de la
 * auditoría del sitio: retomar el blog con cadencia regular, orientado a
 * palabras clave de intención de cliente en RD, firmado como JAYM Legal).
 *
 * Mismo criterio que el resto de funciones de IA del sistema (ver
 * redaccion.service.ts): la IA propone un BORRADOR, nunca inventa datos
 * verificables (leyes, artículos, cifras, plazos) que no pueda dar en
 * términos generales -- Joseph siempre revisa antes de programar la
 * publicación.
 */
@Injectable()
export class RedaccionBlogService {
  private readonly logger = new Logger(RedaccionBlogService.name);

  constructor(private readonly config: ConfigService) {}

  private cliente(): Anthropic {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new BadRequestException(
        'La función de redactar blogs con IA todavía no está activada: falta configurar ANTHROPIC_API_KEY en el backend.',
      );
    }
    return new Anthropic({ apiKey });
  }

  async generarBorrador(tema: string, areaPractica?: MateriaJuridica): Promise<BorradorBlogGenerado> {
    const temaLimpio = String(tema ?? '').trim();
    if (!temaLimpio) {
      throw new BadRequestException('Escribe el tema o la palabra clave sobre la que debe tratar el blog.');
    }

    const anthropic = this.cliente();
    const areaTexto = areaPractica ? ETIQUETAS_AREA[areaPractica] : undefined;

    let respuesta: Anthropic.Message;
    try {
      respuesta = await anthropic.messages.create({
        model: MODELO,
        max_tokens: 4000,
        system:
          `Eres un redactor de contenido SEO para el blog de ${MARCA_CORPORATIVA.razonSocial} ("${MARCA_CORPORATIVA.eslogan}"), un bufete de abogados en La Romana, República Dominicana. ` +
          'Escribes artículos orientados a personas que están buscando resolver un problema legal concreto y podrían necesitar contratar al bufete -- no artículos genéricos de interés general. ' +
          'Escribe siempre en español, en un tono profesional pero cercano y fácil de entender para alguien sin formación jurídica. ' +
          (areaTexto ? `El artículo debe ser sobre ${areaTexto}. ` : '') +
          'Estructura el artículo con encabezados claros (usa <h2> para las secciones principales), párrafos cortos, y cuando aplique una lista de requisitos o pasos usa <ul>/<ol>. ' +
          'Incluye, cuando sea natural, la ubicación "La Romana" y/o "República Dominicana" para posicionamiento local, y cierra con un párrafo breve invitando a agendar una consulta con JAYM Legal (sin inventar un enlace ni un teléfono -- solo menciona "JAYM Legal" o "nuestro equipo"). ' +
          `Al final del artículo, en un párrafo aparte, firma como "${ABOGADO_RESPONSABLE.nombreCompleto}" seguido de "${MARCA_CORPORATIVA.razonSocial}" en una segunda línea. ` +
          'Regla más importante, sin excepción: NUNCA inventes un número de artículo de ley, plazo exacto, tarifa, cifra o cita textual que no sea de conocimiento general y verificable -- si necesitas mencionar un plazo o requisito legal específico, escríbelo en términos generales o entre corchetes como "[verificar plazo vigente]" en vez de adivinar un número. Este es un borrador que el abogado revisará antes de publicar. ' +
          'Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional antes o después, con exactamente estas claves: ' +
          '"titulo" (string, un título atractivo y orientado a SEO, sin comillas), ' +
          '"extracto" (string, un resumen de 1-2 frases para usar como extracto/meta descripción), ' +
          '"contenidoHtml" (string, el cuerpo completo del artículo en HTML simple: <h2>, <p>, <ul>/<ol>/<li>, <strong>/<em> -- sin <html>/<body>, sin estilos ni clases).',
        messages: [
          {
            role: 'user',
            content: `Tema/palabra clave para el artículo: ${temaLimpio}`,
          },
        ],
      });
    } catch (err) {
      this.logger.error(`Error llamando a Anthropic para redactar blog ("${temaLimpio}"): ${(err as Error).message}`);
      throw new BadRequestException('No se pudo generar el borrador del blog. Intenta de nuevo en unos minutos.');
    }

    const texto = respuesta.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    if (!texto) {
      throw new BadRequestException('No se pudo generar el borrador del blog. Intenta reformular el tema.');
    }

    let datos: { titulo?: string; extracto?: string; contenidoHtml?: string };
    try {
      // La IA puede envolver el JSON en un bloque ```json -- se limpia por
      // si acaso antes de parsear.
      const limpio = texto.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      datos = JSON.parse(limpio);
    } catch {
      this.logger.error(`Respuesta de Anthropic no fue JSON válido al redactar blog: ${texto.slice(0, 500)}`);
      throw new BadRequestException('No se pudo interpretar el borrador generado. Intenta de nuevo.');
    }

    if (!datos.titulo || !datos.contenidoHtml) {
      throw new BadRequestException('El borrador generado quedó incompleto. Intenta de nuevo.');
    }

    return {
      titulo: datos.titulo.trim(),
      contenidoHtml: datos.contenidoHtml.trim(),
      extracto: (datos.extracto ?? '').trim(),
      advertencia:
        'Borrador de blog generado por IA -- revisa cada dato, plazo, artículo de ley o cifra antes de programar su publicación.',
    };
  }
}
