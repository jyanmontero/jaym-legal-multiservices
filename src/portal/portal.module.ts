import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PortalUsuario } from './portal-usuario.entity.js';
import { PortalPasswordResetToken } from './portal-password-reset-token.entity.js';
import { MensajePortal } from './mensaje-portal.entity.js';
import { Expediente } from '../expedientes/expediente.entity.js';
import { AgendaEvento } from '../agenda/agenda-evento.entity.js';
import { PortalAuthService } from './portal-auth.service.js';
import { PortalUsuariosAdminService } from './portal-usuarios-admin.service.js';
import { PortalDatosService } from './portal-datos.service.js';
import { PortalAuthController } from './portal-auth.controller.js';
import { PortalAdminController } from './portal-admin.controller.js';
import { PortalController } from './portal.controller.js';
import { MensajesStaffController } from './mensajes-staff.controller.js';
import { NotificacionesModule } from '../notificaciones/notificaciones.module.js';
import { DocumentosModule } from '../documentos/documentos.module.js';
import { FacturacionModule } from '../facturacion/facturacion.module.js';
import { RequisitosModule } from '../requisitos/requisitos.module.js';
import { ClientesModule } from '../clientes/clientes.module.js';
import { obtenerJwtSecretObligatorio } from '../common/config/jwt-secret.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([PortalUsuario, PortalPasswordResetToken, MensajePortal, Expediente, AgendaEvento]),
    NotificacionesModule,
    DocumentosModule,
    FacturacionModule,
    RequisitosModule,
    ClientesModule,
    // Mismo secreto que el JWT de staff (JWT_SECRET), pero una sesión de
    // portal dura más (30 días): un cliente no entra a diario como el
    // staff, y forzar un re-login constante solo genera fricción sin
    // beneficio real de seguridad -- el payload (`tipo: 'portal'`) nunca
    // puede usarse para acceder a rutas internas de todos modos.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: obtenerJwtSecretObligatorio(config),
        signOptions: { expiresIn: '30d' },
      }),
    }),
  ],
  controllers: [PortalAuthController, PortalAdminController, PortalController, MensajesStaffController],
  providers: [PortalAuthService, PortalUsuariosAdminService, PortalDatosService],
})
export class PortalModule {}
