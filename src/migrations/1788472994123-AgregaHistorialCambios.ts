import { MigrationInterface, QueryRunner } from "typeorm";

export class AgregaHistorialCambios1788472994123 implements MigrationInterface {
    name = 'AgregaHistorialCambios1788472994123'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "historial_cambios" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "entidadTipo" character varying(20) NOT NULL, "entidadId" character varying NOT NULL, "snapshotAnterior" jsonb NOT NULL, "snapshotNuevo" jsonb NOT NULL, "camposModificados" text array NOT NULL, "usuarioId" character varying NOT NULL, "motivo" text, "creadoEn" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d013e787240859f57c3351ed07c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1fe9782b558702a6e87b625b54" ON "historial_cambios"  ("entidadTipo", "entidadId", "creadoEn") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_1fe9782b558702a6e87b625b54"`);
        await queryRunner.query(`DROP TABLE "historial_cambios"`);
    }

}
