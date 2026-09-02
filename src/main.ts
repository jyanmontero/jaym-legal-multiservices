import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { DepuracionTemporalFilter } from './common/filters/depuracion-temporal.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  // TEMPORAL: mientras se investiga el error 500 al crear facturas — ver
  // comentario en depuracion-temporal.filter.ts. Quitar esta línea (y el
  // archivo) una vez resuelto ese error.
  app.useGlobalFilters(new DepuracionTemporalFilter());
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
  console.log(`JAYM LEGAL API escuchando en el puerto ${process.env.PORT ?? 3000}`);
}
await bootstrap();
