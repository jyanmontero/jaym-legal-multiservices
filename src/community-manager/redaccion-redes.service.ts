import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { FICHA_MARCA, INFO_REDES, REDES, type RedSocial } from './ficha-marca.js';

const MODELO = 'claude-sonnet-5';

export interface EntradaRedaccion {
  tema: string;
  /** Texto de apoyo con los datos reales (por ejemplo, el cuerpo del artículo del blog). */
  contexto?: string;
  enlace?: string;
  redes: RedSocial[];
  /** Indicaciones extra de Joseph al regenerar ("más corto", "más directo"...). */
  instrucciones?: string;
}

export interface IdeaSemana {
  titulo: string;
  tema: string;
  textos: Partial<Record<RedSocial, string>>;
}

/**
 * Cerebro del Community Manager: redacta el mismo mensaje adaptado a cada
 * red respetando la ficha de marca (horario, correos, servicios oficiales) y
 * las reglas de ética de publicidad jurídica. Solo propone: nunca publica.
 */
@Injectable()
export class RedaccionRedesService {
  private readonly logger = new Logger(RedaccionRedesService.name);

  constructor(private readonly config: ConfigService) {}

  private cliente(): Anthropic {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new BadRequestException(
        'El Community Manager todavía no tiene la IA activada: falta configurar ANTHROPIC_API_KEY en el backend.',
      );
    }
    return new Anthropic({ apiKey });
  }

  private reglasMarca(): string {
    const f = FICHA_MARCA;
    return (
      `Eres el Community Manager de ${f.razonSocial} ("${f.lema}"), firma legal en La Romana, República Dominicana. ` +
      `El abogado fundador es el Lic. Joseph Alcides Yan Montero (cargo público: ${f.cargoPublico}). ` +
      'Escribes siempre en español dominicano profesional, cercano y claro para alguien sin formación jurídica. ' +
      `Datos oficiales (úsalos exactamente así, nunca otros): teléfono y WhatsApp ${f.telefonoWhatsapp}; correo ${f.correoPublico}; sitio ${f.sitioWeb}; horario: ${f.horario}; dirección: ${f.direccion}. ` +
      `Servicios oficiales de la firma: ${f.servicios.join('; ')}. ` +
      'La firma NO ofrece como servicio derecho penal, laboral ni litigio administrativo: si el tema toca esas áreas, trátalo solo como información general y no invites a contratar la firma para eso; ofrece orientación en lo que sí hace. ' +
      'REGLAS ESTRICTAS: (1) nunca menciones precios, tarifas, honorarios ni descuentos; (2) nunca prometas ni garantices resultados ni uses frases como "ganamos tu caso"; (3) nunca inventes leyes, artículos, fechas, plazos ni cifras: usa únicamente los datos del contexto que se te dé, y si no hay contexto habla en términos generales; (4) nunca publiques el correo personal ni datos de clientes; (5) cuando expliques una norma o una noticia jurídica agrega al final una línea breve: "Contenido informativo; no constituye asesoría legal."; (6) invita a la acción con el WhatsApp o el correo oficial, sin presionar. '
    );
  }

  private guiaRedes(redes: RedSocial[]): string {
    return redes
      .map((r) => `- "${r}" (${INFO_REDES[r].nombre}, máximo ${INFO_REDES[r].limite} caracteres): ${INFO_REDES[r].estilo}`)
      .join('\n');
  }

  private extraerJson<T>(texto: string): T {
    const limpio = texto.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    try {
      return JSON.parse(limpio) as T;
    } catch {
      this.logger.error(`Respuesta de IA no fue JSON válido: ${texto.slice(0, 400)}`);
      throw new BadRequestException('No se pudo interpretar la propuesta generada. Intenta de nuevo.');
    }
  }

  private async llamar(system: string, user: string, maxTokens: number): Promise<string> {
    const anthropic = this.cliente();
    try {
      const respuesta = await anthropic.messages.create({
        model: MODELO,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      });
      const texto = respuesta.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      if (!texto) throw new Error('respuesta vacía');
      return texto;
    } catch (err) {
      this.logger.error(`Error llamando a Anthropic (Community Manager): ${(err as Error).message}`);
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('No se pudo generar la propuesta. Intenta de nuevo en unos minutos.');
    }
  }

  private limpiarTextos(
    datos: Partial<Record<string, unknown>>,
    redes: RedSocial[],
  ): Partial<Record<RedSocial, string>> {
    const salida: Partial<Record<RedSocial, string>> = {};
    for (const red of redes) {
      const valor = datos[red];
      if (typeof valor === 'string' && valor.trim()) salida[red] = valor.trim();
    }
    return salida;
  }

  async redactar(entrada: EntradaRedaccion): Promise<Partial<Record<RedSocial, string>>> {
    const tema = String(entrada.tema ?? '').trim();
    if (!tema) throw new BadRequestException('Escribe el tema de la publicación.');
    const redes = entrada.redes.filter((r) => REDES.includes(r));
    if (redes.length === 0) throw new BadRequestException('Elige al menos una red.');

    const system =
      this.reglasMarca() +
      `Adapta el mensaje a cada red según su estilo y su límite de caracteres:\n${this.guiaRedes(redes)}\n` +
      'Responde ÚNICAMENTE con un objeto JSON válido (sin texto antes ni después) cuyas claves sean exactamente los identificadores de red pedidos y cuyos valores sean el texto listo para publicar.';

    const partes = [`Tema de la publicación: ${tema}`];
    if (entrada.enlace) {
      partes.push(
        `Enlace del artículo (inclúyelo solo en las redes cuyo estilo lo permite): ${entrada.enlace}`,
      );
    }
    if (entrada.contexto) {
      partes.push(`Datos reales para basarte (no agregues nada que no esté aquí):\n${entrada.contexto.slice(0, 6000)}`);
    }
    if (entrada.instrucciones) partes.push(`Indicaciones adicionales de Joseph: ${entrada.instrucciones}`);

    const texto = await this.llamar(system, partes.join('\n\n'), 4000);
    const datos = this.extraerJson<Record<string, unknown>>(texto);
    const textos = this.limpiarTextos(datos, redes);
    if (Object.keys(textos).length === 0) {
      throw new BadRequestException('La propuesta salió vacía. Intenta de nuevo con otro tema.');
    }
    return textos;
  }

  async sugerirSemana(cantidad: number, redes: RedSocial[]): Promise<IdeaSemana[]> {
    const n = Math.min(Math.max(Math.round(cantidad) || 5, 1), 7);
    const lista = redes.filter((r) => REDES.includes(r));
    if (lista.length === 0) throw new BadRequestException('Elige al menos una red.');

    const system =
      this.reglasMarca() +
      `Propón ${n} ideas de publicación para la semana, distintas entre sí, cada una de una de las áreas oficiales (varía las áreas), de tipo educativo y atemporal: preguntas frecuentes, requisitos generales, errores comunes, cómo prepararse para un trámite. No uses noticias ni normas recientes (no tienes datos verificados) y no cites números de ley ni plazos exactos. ` +
      `Para cada idea redacta el texto adaptado a estas redes:\n${this.guiaRedes(lista)}\n` +
      'Responde ÚNICAMENTE con un arreglo JSON válido; cada elemento: {"titulo": string corto interno, "tema": string de una frase, "textos": { "<red>": "<texto>" }} usando solo las claves de red pedidas.';

    const texto = await this.llamar(system, `Genera las ${n} ideas de la semana.`, 8000);
    const datos = this.extraerJson<Array<{ titulo?: string; tema?: string; textos?: Record<string, unknown> }>>(texto);
    if (!Array.isArray(datos)) throw new BadRequestException('No se pudieron interpretar las ideas generadas.');

    return datos
      .map((d) => ({
        titulo: String(d.titulo ?? d.tema ?? 'Idea de la semana').trim(),
        tema: String(d.tema ?? d.titulo ?? '').trim(),
        textos: this.limpiarTextos(d.textos ?? {}, lista),
      }))
      .filter((d) => Object.keys(d.textos).length > 0);
  }
}
