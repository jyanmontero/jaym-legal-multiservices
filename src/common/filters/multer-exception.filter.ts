import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { MulterError } from 'multer';

/**
 * Multer, por defecto, deja pasar sus propios mensajes de error en inglés
 * ("File too large", "Unexpected field", etc.) tal cual al cliente. Este
 * filtro los traduce a mensajes claros en español, y usa el código HTTP
 * correcto (413 para archivo demasiado grande, 400 para el resto) en vez
 * de dejar que caigan en un genérico 500.
 *
 * No conoce el límite exacto en bytes de cada endpoint (cada controlador
 * define el suyo) -- el mensaje es intencionalmente genérico para servir
 * igual en cualquiera de ellos.
 */
@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    const mensajesPorCodigo: Partial<Record<string, string>> = {
      LIMIT_FILE_SIZE:
        'El archivo es demasiado grande para esta sección. Divídelo, comprímelo o súbelo como varios documentos más pequeños.',
      LIMIT_FILE_COUNT: 'Se excedió la cantidad máxima de archivos que se pueden subir juntos.',
      LIMIT_UNEXPECTED_FILE: 'No se esperaba un archivo en ese campo.',
    };

    const estado =
      exception.code === 'LIMIT_FILE_SIZE' ? HttpStatus.PAYLOAD_TOO_LARGE : HttpStatus.BAD_REQUEST;

    response.status(estado).json({
      statusCode: estado,
      message: mensajesPorCodigo[exception.code] ?? 'No se pudo procesar el archivo subido.',
    });
  }
}
