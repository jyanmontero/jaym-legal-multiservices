import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ClientesModule } from './clientes/clientes.module.js';
import { ExpedientesModule } from './expedientes/expedientes.module.js';
import { HistorialModule } from './historial/historial.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DocumentosModule } from './documentos/documentos.module.js';
import { RequisitosModule } from './requisitos/requisitos.module.js';
import { AgendaModule } from './agenda/agenda.module.js';
import { AlertasModule } from './alertas/alertas.module.js';
import { FacturacionModule } from './facturacion/facturacion.module.js';
import { HubSpotModule } from './integraciones/hubspot/hubspot.module.js';
import { GoogleCalendarModule } from './integraciones/google-calendar/google-calendar.module.js';
import { AsistenteModule } from './asistente/asistente.module.js';
import { PlantillasModule } from './plantillas/plantillas.module.js';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // Límite general de peticiones por IP; el login tiene un límite más
    // estricto propio vía @Throttle() en auth.controller.ts.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 100 }]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL') ?? '';
        // Neon (y la mayoría de proveedores de Postgres en la nube) exigen
        // conexión cifrada. Se detecta automáticamente por la URL para no
        // requerir configuración manual extra; en Postgres local no aplica.
        const requiereSSL = /sslmode=require|neon\.tech|supabase\.co|render\.com/.test(databaseUrl);

        return {
          type: 'postgres',
          url: databaseUrl,
          autoLoadEntities: true,
          // synchronize solo debe usarse en desarrollo. En producción se
          // deben usar migraciones (ver carpeta src/migrations, pendiente
          // de generar con `npm run typeorm migration:generate`).
          synchronize: config.get('NODE_ENV') !== 'production',
          logging: config.get('NODE_ENV') === 'development',
          ssl: requiereSSL ? { rejectUnauthorized: false } : false,
        };
      },
    }),
    UsuariosModule,
    AuthModule,
    ClientesModule,
    ExpedientesModule,
    HistorialModule,
    DocumentosModule,
    RequisitosModule,
    AgendaModule,
    AlertasModule,
    FacturacionModule,
    HubSpotModule,
    GoogleCalendarModule,
    AsistenteModule,
    PlantillasModule,
  ],
  providers: [
    // Guard global de límite de peticiones (debe ir antes que el de JWT
    // para frenar intentos de fuerza bruta incluso en rutas @Public()).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Guard global: todo endpoint exige JWT salvo los marcados con @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
