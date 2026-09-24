import { MigrationInterface, QueryRunner } from "typeorm";

export class AgregaColaboradores1790215752840 implements MigrationInterface {
    name = 'AgregaColaboradores1790215752840'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."colaboradores_tipo_enum" AS ENUM('externo', 'interno')`);
        await queryRunner.query(`CREATE TABLE "colaboradores" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombreCompleto" character varying NOT NULL, "correo" character varying NOT NULL, "passwordHash" character varying NOT NULL, "tipo" "public"."colaboradores_tipo_enum" NOT NULL, "telefono" character varying, "notas" text, "activo" boolean NOT NULL DEFAULT true, "debeCambiarPassword" boolean NOT NULL DEFAULT true, "ultimoAcceso" TIMESTAMP, "intentosFallidosLogin" integer NOT NULL DEFAULT 0, "bloqueadoHastaLogin" TIMESTAMP, "creadoPorId" character varying, "creadoEn" TIMESTAMP NOT NULL DEFAULT now(), "actualizadoEn" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_colaboradores_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_colaboradores_correo" ON "colaboradores" ("correo") `);

        await queryRunner.query(`CREATE TABLE "colaboradores_expedientes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "colaboradorId" character varying NOT NULL, "expedienteId" character varying NOT NULL, "notas" character varying, "asignadoPorId" character varying NOT NULL, "asignadoEn" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_colaborador_expediente" UNIQUE ("colaboradorId", "expedienteId"), CONSTRAINT "PK_colaboradores_expedientes_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_colaboradores_expedientes_colaboradorId" ON "colaboradores_expedientes" ("colaboradorId") `);
        await queryRunner.query(`CREATE INDEX "IDX_colaboradores_expedientes_expedienteId" ON "colaboradores_expedientes" ("expedienteId") `);

        await queryRunner.query(`CREATE TABLE "colaborador_password_reset_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "colaboradorId" character varying NOT NULL, "tokenHash" character varying NOT NULL, "expiraEn" TIMESTAMP NOT NULL, "usadoEn" TIMESTAMP, "creadoEn" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_colaborador_password_reset_tokens_tokenHash" UNIQUE ("tokenHash"), CONSTRAINT "PK_colaborador_password_reset_tokens_id" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "colaborador_password_reset_tokens"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_colaboradores_expedientes_expedienteId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_colaboradores_expedientes_colaboradorId"`);
        await queryRunner.query(`DROP TABLE "colaboradores_expedientes"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_colaboradores_correo"`);
        await queryRunner.query(`DROP TABLE "colaboradores"`);
        await queryRunner.query(`DROP TYPE "public"."colaboradores_tipo_enum"`);
    }

}
