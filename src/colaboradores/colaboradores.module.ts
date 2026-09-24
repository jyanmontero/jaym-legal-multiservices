import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Colaborador } from './colaborador.entity.js';
import { ColaboradorExpediente } from './colaborador-expediente.entity.js';
import { ColaboradorPasswordResetToken } from './colaborador-password-reset-token.entity.js';
import { Expediente } from '../expedientes/expediente.entity.js';
import { AgendaEvento } from '../agenda/agenda-evento.entity.js';
import { Documento } from '../documentos/documento.entity.js';
import { ColaboradorAuthService } from './colaborador-auth.service.js';
import { ColaboradoresAdminService } from './colaboradores-admin.service.js';
import { ColaboradoresPortalService } from './colaboradores-portal.service.js';
import { ColaboradorAuthController } from './colaborador-auth.controller.js';
import { ColaboradoresAdminController } from './colaboradores-admin.controller.js';
import { ColaboradoresPortalController } from './colaboradores-portal.controller.js';
import { NotificacionesModule } from '../notificaciones/notificaciones.module.js';
import { DocumentosModule } from '../documentos/documentos.module.js';
import { obtenerJwtSecretObligatorio } from '../common/config/jwt-secret.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Colaborador, ColaboradorExpediente, ColaboradorPasswordResetToken, Expediente, AgendaEvento, Documento]),
    NotificacionesModule,
    DocumentosModule,
    // Mismo secreto que el JWT de staff (JWT_SECRET) y que el del Portal del
    // Cliente, pero con su propia duración: un colaborador (externo o de
    // apoyo interno) no entra a diario como el staff, pero maneja
    // información de expedientes reales -- 14 días es un punto medio entre
    // la fricción de un re-login constante y la duración de 30 días que se
    // le da al cliente final, que solo consulta su propio caso.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: obtenerJwtSecretObligatorio(config),
        signOptions: { expiresIn: '14d' },
      }),
    }),
  ],
  controllers: [ColaboradorAuthController, ColaboradoresAdminController, ColaboradoresPortalController],
  providers: [ColaboradorAuthService, ColaboradoresAdminService, ColaboradoresPortalService],
})
export class ColaboradoresModule {}
