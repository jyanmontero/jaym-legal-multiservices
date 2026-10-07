import { MigrationInterface, QueryRunner } from "typeorm";

export class AgregaRequisitosPorServicio1791400000001 implements MigrationInterface {
    name = 'AgregaRequisitosPorServicio1791400000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DO $$ BEGIN CREATE TYPE "public"."servicios_catalogo_materia_enum" AS ENUM('civil', 'comercial', 'penal', 'laboral', 'familia', 'inmobiliario', 'migratorio', 'administrativo', 'constitucional', 'registro_civil_jce', 'notarial', 'corporativo', 'propiedad_intelectual', 'cobros', 'proteccion_consumidor', 'seguridad_social', 'otra'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "servicios_catalogo" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "codigo" character varying NOT NULL, "area" character varying NOT NULL, "materia" "public"."servicios_catalogo_materia_enum" NOT NULL, "nombre" character varying NOT NULL, "baseLegal" jsonb NOT NULL DEFAULT '[]', "competencia" text, "etapas" jsonb NOT NULL DEFAULT '[]', "preguntas" jsonb NOT NULL DEFAULT '[]', "activo" boolean NOT NULL DEFAULT true, "version" integer NOT NULL DEFAULT 1, "creadoEn" TIMESTAMP NOT NULL DEFAULT now(), "actualizadoEn" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_servicios_catalogo_codigo" UNIQUE ("codigo"), CONSTRAINT "PK_servicios_catalogo_id" PRIMARY KEY ("id"))`);

        await queryRunner.query(`ALTER TABLE "requisitos_plantilla" ADD COLUMN IF NOT EXISTS "codigo" character varying`);
        await queryRunner.query(`ALTER TABLE "requisitos_plantilla" ADD COLUMN IF NOT EXISTS "servicioCodigo" character varying`);
        await queryRunner.query(`ALTER TABLE "requisitos_plantilla" ADD COLUMN IF NOT EXISTS "general" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "requisitos_plantilla" ADD COLUMN IF NOT EXISTS "tipo" character varying`);
        await queryRunner.query(`ALTER TABLE "requisitos_plantilla" ADD COLUMN IF NOT EXISTS "categoriaDocumento" character varying`);
        await queryRunner.query(`ALTER TABLE "requisitos_plantilla" ADD COLUMN IF NOT EXISTS "aporta" character varying`);
        await queryRunner.query(`ALTER TABLE "requisitos_plantilla" ADD COLUMN IF NOT EXISTS "condicion" character varying`);
        await queryRunner.query(`ALTER TABLE "requisitos_plantilla" ADD COLUMN IF NOT EXISTS "validar" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "requisitos_plantilla" ADD COLUMN IF NOT EXISTS "nota" text`);
        await queryRunner.query(`ALTER TABLE "requisitos_plantilla" ADD COLUMN IF NOT EXISTS "aprobadoEn" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "requisitos_plantilla" ADD COLUMN IF NOT EXISTS "aprobadoPorId" character varying`);
        await queryRunner.query(`DO $$ BEGIN ALTER TABLE "requisitos_plantilla" ADD CONSTRAINT "UQ_requisitos_plantilla_codigo" UNIQUE ("codigo"); EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$`);

        await queryRunner.query(`ALTER TABLE "expediente_requisitos" ADD COLUMN IF NOT EXISTS "origen" character varying NOT NULL DEFAULT 'materia'`);
        await queryRunner.query(`ALTER TABLE "expediente_requisitos" ADD COLUMN IF NOT EXISTS "plantillaCodigo" character varying`);
        await queryRunner.query(`ALTER TABLE "expediente_requisitos" ADD COLUMN IF NOT EXISTS "tipo" character varying`);
        await queryRunner.query(`ALTER TABLE "expediente_requisitos" ADD COLUMN IF NOT EXISTS "categoriaDocumento" character varying`);
        await queryRunner.query(`ALTER TABLE "expediente_requisitos" ADD COLUMN IF NOT EXISTS "aporta" character varying`);
        await queryRunner.query(`ALTER TABLE "expediente_requisitos" ADD COLUMN IF NOT EXISTS "validar" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "expediente_requisitos" ADD COLUMN IF NOT EXISTS "motivoNoAplica" text`);
        // Los requisitos ya existentes que se agregaron a mano quedan como 'manual'.
        await queryRunner.query(`UPDATE "expediente_requisitos" SET "origen" = 'manual' WHERE "requisitoPlantillaId" IS NULL AND "origen" = 'materia'`);

        await queryRunner.query(`ALTER TABLE "expedientes" ADD COLUMN IF NOT EXISTS "servicioCodigo" character varying`);
        await queryRunner.query(`ALTER TABLE "expedientes" ADD COLUMN IF NOT EXISTS "perfil" jsonb NOT NULL DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "expedientes" DROP COLUMN IF EXISTS "perfil"`);
        await queryRunner.query(`ALTER TABLE "expedientes" DROP COLUMN IF EXISTS "servicioCodigo"`);
        for (const c of ["motivoNoAplica","validar","aporta","categoriaDocumento","tipo","plantillaCodigo","origen"]) {
            await queryRunner.query(`ALTER TABLE "expediente_requisitos" DROP COLUMN IF EXISTS "${c}"`);
        }
        await queryRunner.query(`ALTER TABLE "requisitos_plantilla" DROP CONSTRAINT IF EXISTS "UQ_requisitos_plantilla_codigo"`);
        for (const c of ["aprobadoPorId","aprobadoEn","nota","validar","condicion","aporta","categoriaDocumento","tipo","general","servicioCodigo","codigo"]) {
            await queryRunner.query(`ALTER TABLE "requisitos_plantilla" DROP COLUMN IF EXISTS "${c}"`);
        }
        await queryRunner.query(`DROP TABLE IF EXISTS "servicios_catalogo"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."servicios_catalogo_materia_enum"`);
    }

}
