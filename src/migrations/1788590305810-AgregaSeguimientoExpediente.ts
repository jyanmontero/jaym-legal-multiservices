import { MigrationInterface, QueryRunner } from "typeorm";

export class AgregaSeguimientoExpediente1788590305810 implements MigrationInterface {
    name = 'AgregaSeguimientoExpediente1788590305810'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "seguimiento_expediente" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "expedienteId" character varying NOT NULL, "usuarioId" character varying NOT NULL, "texto" text NOT NULL, "hito" boolean NOT NULL DEFAULT false, "creadoEn" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_seguimiento_expediente_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_seguimiento_expediente_exp_fecha" ON "seguimiento_expediente" ("expedienteId", "creadoEn") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_seguimiento_expediente_exp_fecha"`);
        await queryRunner.query(`DROP TABLE "seguimiento_expediente"`);
    }

}
