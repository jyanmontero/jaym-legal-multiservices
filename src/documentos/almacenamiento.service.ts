import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Readable } from 'stream';

// Carpeta usada solo como respaldo para desarrollo local, cuando no hay
// credenciales de R2 configuradas (ver AlmacenamientoService más abajo).
export const CARPETA_ALMACENAMIENTO = path.resolve(process.cwd(), 'storage', 'documentos');

/**
 * Almacenamiento de archivos de documentos (sección 12 del requerimiento).
 *
 * En producción, los documentos se guardan en Cloudflare R2 (compatible con
 * la API de Amazon S3) en vez del disco del servidor -- Render no garantiza
 * que el disco persista entre despliegues. Si no hay credenciales de R2
 * configuradas (R2_ACCOUNT_ID ausente), se usa el disco local como
 * respaldo -- esto es lo que pasa automáticamente en desarrollo en la
 * máquina de cada quien, sin necesitar configurar nada.
 */
@Injectable()
export class AlmacenamientoService {
  private readonly logger = new Logger(AlmacenamientoService.name);
  private readonly s3?: S3Client;
  private readonly bucket = process.env.R2_BUCKET_NAME ?? '';
  readonly usaR2: boolean;

  constructor() {
    this.usaR2 = Boolean(process.env.R2_ACCOUNT_ID);

    if (this.usaR2) {
      this.s3 = new S3Client({
        region: 'auto',
        forcePathStyle: true,
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
        },
      });
      this.logger.log('Almacenamiento de documentos: Cloudflare R2 (bucket ' + this.bucket + ')');
    } else {
      this.logger.warn(
        'Almacenamiento de documentos: disco local (solo para desarrollo -- configurar R2_ACCOUNT_ID en producción)',
      );
    }
  }

  /** Sube el contenido de un archivo bajo la clave (nombre) indicada. */
  async subir(clave: string, contenido: Buffer, tipoMime: string): Promise<void> {
    if (this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: clave,
          Body: contenido,
          ContentType: tipoMime,
        }),
      );
      return;
    }

    await fs.mkdir(CARPETA_ALMACENAMIENTO, { recursive: true });
    await fs.writeFile(path.join(CARPETA_ALMACENAMIENTO, clave), contenido);
  }

  /**
   * Devuelve una URL firmada y temporal (5 minutos) para descargar el
   * archivo directamente desde R2, o null si se está usando el disco local
   * (en ese caso el controller sirve el archivo directamente con
   * res.download() y rutaLocal()).
   */
  async urlDescarga(clave: string, nombreArchivo: string): Promise<string | null> {
    if (!this.s3) return null;

    const comando = new GetObjectCommand({
      Bucket: this.bucket,
      Key: clave,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(nombreArchivo)}"`,
    });

    return getSignedUrl(this.s3, comando, { expiresIn: 300 });
  }

  /**
   * Descarga el archivo de R2 hacia este mismo servidor y devuelve su
   * contenido como stream, en vez de una URL firmada -- así el controller
   * puede entregárselo al navegador directamente (mismo origen que el resto
   * de la API), sin que el navegador tenga que hablar con Cloudflare R2.
   *
   * Esto evita por completo el bloqueo de CORS que ocurre cuando el
   * navegador sigue una redirección hacia una URL firmada de R2 y el
   * bucket no responde con el encabezado Access-Control-Allow-Origin
   * esperado para el origen exacto del frontend (bug detectado el
   * 19-20 de septiembre de 2026 -- ver auditoría del proyecto).
   *
   * Devuelve null si se está usando el disco local (en ese caso el
   * controller sirve el archivo directamente con res.download() y
   * rutaLocal()).
   */
  async streamDescarga(
    clave: string,
  ): Promise<{ body: Readable; contentType?: string; contentLength?: number } | null> {
    if (!this.s3) return null;

    const respuesta = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: clave }));

    return {
      body: respuesta.Body as unknown as Readable,
      contentType: respuesta.ContentType,
      contentLength: respuesta.ContentLength,
    };
  }

  /** Borra el archivo físico -- tolerante si ya no existe. */
  async eliminar(clave: string): Promise<void> {
    if (this.s3) {
      await this.s3
        .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: clave }))
        .catch(() => undefined);
      return;
    }

    await fs.unlink(path.join(CARPETA_ALMACENAMIENTO, clave)).catch(() => undefined);
  }

  /** Solo válido cuando usaR2 es false -- ruta física en el disco local. */
  rutaLocal(clave: string): string {
    return path.join(CARPETA_ALMACENAMIENTO, clave);
  }
}
