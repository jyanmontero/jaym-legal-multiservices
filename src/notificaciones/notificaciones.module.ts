import { Module } from '@nestjs/common';
import { CorreoService } from './correo.service.js';

@Module({
  providers: [CorreoService],
  exports: [CorreoService],
})
export class NotificacionesModule {}
