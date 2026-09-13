// Fuente de datos para el CLI de TypeORM (migraciones). Este archivo NO lo
// usa la aplicación en sí -- app.module.ts arma su propia conexión con
// TypeOrmModule.forRootAsync(). Este data-source existe solo para poder
// correr:
//
//   npm run migration:generate -- src/migrations/NombreDeLaMigracion
//   npm run migration:run
//   npm run migration:revert
//
// En desarrollo local synchronize:true sigue creando/actualizando las
// tablas automáticamente (ver app.module.ts) -- las migraciones son para
// producción, donde synchronize está apagado a propósito y todo cambio de
// esquema debe quedar documentado y ser reversible.
import 'reflect-metadata';
import { config as cargarEnv } from 'dotenv';
import { DataSource } from 'typeorm';

cargarEnv();

const databaseUrl = process.env.DATABASE_URL ?? '';
const requiereSSL = /sslmode=require|neon\.tech|supabase\.co|render\.com/.test(databaseUrl);

export default new DataSource({
  type: 'postgres',
  url: databaseUrl,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  ssl: requiereSSL ? { rejectUnauthorized: false } : false,
});
