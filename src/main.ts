import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { MulterExceptionFilter } from './common/filters/multer-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Render pone un proxy delante: sin esto, req.ip es siempre el del proxy y el
  // limite de intentos y la auditoria de accesos veian una sola "IP" para todos.
  app.set('trust proxy', 1);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  // Cabeceras de seguridad HTTP basicas (X-Frame-Options, X-Content-Type-Options,
  // etc.) — Fase 0 de la hoja de ruta a produccion.
  app.use(helmet());
  app.useGlobalFilters(new MulterExceptionFilter());
  // CORS restringido al dominio real del frontend. FRONTEND_URL puede traer
  // varios origenes separados por coma (ej. produccion + staging). En
  // desarrollo, si no se define, cae de vuelta a localhost:5173.
  const origenesPermitidos = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({ origin: origenesPermitidos });
  await app.listen(process.env.PORT ?? 3000);
  console.log(`JAYM LEGAL API escuchando en el puerto ${process.env.PORT ?? 3000}`);
}
await bootstrap();
