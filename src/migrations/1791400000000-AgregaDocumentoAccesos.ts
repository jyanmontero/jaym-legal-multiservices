import { MigrationInterface, QueryRunner } from "typeorm";

export class AgregaDocumentoAccesos1791400000000 implements MigrationInterface {
    name = 'AgregaDocumentoAccesos1791400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "documento_accesos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "documentoId" uuid NOT NULL, "usuarioId" character varying NOT NULL, "accion" character varying NOT NULL, "ip" character varying, "creadoEn" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_documento_accesos_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_documento_accesos_documento" ON "documento_accesos" ("documentoId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_documento_accesos_usuario" ON "documento_accesos" ("usuarioId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_documento_accesos_usuario"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_documento_accesos_documento"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "documento_accesos"`);
    }

}
