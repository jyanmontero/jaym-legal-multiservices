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
