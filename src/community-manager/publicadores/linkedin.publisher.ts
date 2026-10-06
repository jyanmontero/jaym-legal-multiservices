import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ResultadoPublicador } from './tipos.js';

/**
 * Publica en LinkedIn con la API de Publicaciones (Posts API). Variables:
 *   LINKEDIN_ACCESS_TOKEN  -- token OAuth con el permiso w_member_social (perfil) o
 *                             w_organization_social (página de empresa)
 *   LINKEDIN_AUTHOR_URN    -- urn:li:person:XXXX (perfil) o urn:li:organization:XXXX (empresa)
 *   LINKEDIN_API_VERSION   -- opcional, formato AAAAMM (por defecto 202506)
 * Los tokens de LinkedIn vencen (60 días): si falla con 401, hay que renovarlo.
 */
@Injectable()
export class LinkedinPublisher {
  private readonly logger = new Logger(LinkedinPublisher.name);

  constructor(private readonly config: ConfigService) {}

  configurado(): boolean {
    return Boolean(this.config.get<string>('LINKEDIN_ACCESS_TOKEN') && this.config.get<string>('LINKEDIN_AUTHOR_URN'));
  }

  private cabeceras(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.get<string>('LINKEDIN_ACCESS_TOKEN')}`,
      'LinkedIn-Version': this.config.get<string>('LINKEDIN_API_VERSION') || '202506',
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
    };
  }

  /** LinkedIn corta el texto si encuentra estos caracteres sin escapar. */
  private escapar(texto: string): string {
    return texto.replace(/[\\|{}@[\]()<>*_~]/g, (c) => `\\${c}`);
  }

  private async subirImagen(autor: string, imagenUrl: string): Promise<string> {
    const inicio = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
      method: 'POST',
      headers: this.cabeceras(),
      body: JSON.stringify({ initializeUploadRequest: { owner: autor } }),
    });
    const datosInicio = (await inicio.json().catch(() => ({}))) as {
      value?: { uploadUrl?: string; image?: string };
      message?: string;
    };
    if (!inicio.ok || !datosInicio.value?.uploadUrl || !datosInicio.value.image) {
      this.logger.error(`LinkedIn initializeUpload falló (${inicio.status}): ${JSON.stringify(datosInicio)}`);
      throw new BadRequestException(
        `LinkedIn rechazó la subida de la imagen (${inicio.status}): ${datosInicio.message ?? 'revisa el token y los permisos'}`,
      );
    }

    const imagen = await fetch(imagenUrl);
    if (!imagen.ok) throw new BadRequestException('No se pudo leer la imagen de la publicación.');
    const bytes = Buffer.from(await imagen.arrayBuffer());

    const subida = await fetch(datosInicio.value.uploadUrl, {
      method: 'PUT',
      headers: { Authorization: this.cabeceras().Authorization },
      body: bytes,
    });
    if (!subida.ok) {
      this.logger.error(`LinkedIn PUT de imagen falló (${subida.status})`);
      throw new BadRequestException(`LinkedIn no aceptó la imagen (${subida.status}).`);
    }
    return datosInicio.value.image;
  }

  async publicar(texto: string, imagenUrl?: string): Promise<ResultadoPublicador> {
    if (!this.configurado()) {
      throw new BadRequestException('Falta configurar LINKEDIN_ACCESS_TOKEN y LINKEDIN_AUTHOR_URN.');
    }
    const autor = this.config.get<string>('LINKEDIN_AUTHOR_URN')!;

    const cuerpo: Record<string, unknown> = {
      author: autor,
      commentary: this.escapar(texto),
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    };
    if (imagenUrl) {
      const imagenUrn = await this.subirImagen(autor, imagenUrl);
      cuerpo.content = { media: { id: imagenUrn, altText: 'JAYM Legal Multiservices' } };
    }

    const respuesta = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: this.cabeceras(),
      body: JSON.stringify(cuerpo),
    });
    if (!respuesta.ok) {
      const detalle = (await respuesta.json().catch(() => ({}))) as { message?: string };
      this.logger.error(`LinkedIn posts falló (${respuesta.status}): ${JSON.stringify(detalle)}`);
      const pista = respuesta.status === 401 ? ' El token venció: genera uno nuevo.' : '';
      throw new BadRequestException(
        `LinkedIn rechazó la publicación (${respuesta.status}): ${detalle.message ?? 'error desconocido'}.${pista}`,
      );
    }
    const urn = respuesta.headers.get('x-restli-id') ?? '';
    return { idExterno: urn, enlace: urn ? `https://www.linkedin.com/feed/update/${urn}` : undefined };
  }
}
