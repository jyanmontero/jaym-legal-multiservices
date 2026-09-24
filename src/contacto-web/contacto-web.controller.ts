import { Controller, Post, Body, Headers, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ContactoWebService } from './contacto-web.service.js';
import { Public } from '../auth/decorators/public.decorator.js';

/**
 * Endpoint público (sin JWT) para el formulario de contacto/citas del sitio
 * de marketing jaymlegalmultiservices.com. Pensado para la acción nativa
 * "Webhook" de Elementor Pro (envío servidor a servidor desde WordPress),
 * protegido con una clave compartida en vez de una sesión -- ver
 * ContactoWebService.verificarClave().
 *
 * La clave se acepta por cabecera `x-webhook-secret` o por query string
 * (`?clave=...`) -- no todos los planes de Elementor Pro permiten agregar
 * cabeceras personalizadas en la acción "Webhook", así que se deja la
 * alternativa por URL como respaldo (ver .env.example).
 */
@Controller('publico')
export class ContactoWebController {
  constructor(private readonly contactoWebService: ContactoWebService) {}

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('contacto-web')
  recibir(
    @Body() body: Record<string, unknown>,
    @Headers('x-webhook-secret') claveHeader?: string,
    @Query('clave') claveQuery?: string,
  ) {
    return this.contactoWebService.procesarEnvio(body, claveHeader ?? claveQuery);
  }
}
