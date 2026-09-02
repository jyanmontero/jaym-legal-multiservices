import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

/**
 * Filtro TEMPORAL para diagnosticar el error 500 al crear facturas.
 *
 * Por defecto, cuando algo falla adentro del backend sin ser un error
 * "esperado" (HttpException), NestJS solo responde con el mensaje genérico
 * "Internal server error" y el detalle real queda solo en la terminal del
 * servidor — que ha sido muy difícil de copiar y enviar. Este filtro,
 * mientras se investiga ese error puntual, incluye también el mensaje real
 * en la respuesta que recibe el navegador, para poder verlo directo en la
 * pantalla (con una captura, como ya se ha hecho con otros errores).
 *
 * IMPORTANTE: quitar este filtro (y la línea que lo activa en main.ts) una
 * vez resuelto el error de facturación — no debe quedar en un sistema en
 * producción, porque expone detalles internos del servidor.
 */
@Catch()
export class DepuracionTemporalFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const cuerpo = exception.getResponse();
      response.status(status).json(typeof cuerpo === 'string' ? { statusCode: status, message: cuerpo } : cuerpo);
      return;
    }

    const error = exception as Error;
    console.error('[DEPURACIÓN TEMPORAL] Error no controlado:', error);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: `[TEMPORAL] ${error?.message ?? 'Error desconocido'}`,
    });
  }
}
