import { MigrationInterface, QueryRunner } from "typeorm";

export class AgregaCommunityManager1791300000000 implements MigrationInterface {
    name = 'AgregaCommunityManager1791300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "publicaciones_redes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "titulo" character varying NOT NULL, "tema" text, "textos" jsonb NOT NULL DEFAULT '{}', "redes" jsonb NOT NULL DEFAULT '[]', "imagenClave" character varying, "enlaceDestino" character varying, "blogPostId" character varying, "estado" character varying NOT NULL DEFAULT 'borrador', "fechaProgramada" TIMESTAMP WITH TIME ZONE, "resultados" jsonb NOT NULL DEFAULT '{}', "aprobadoPorId" character varying, "aprobadoEn" TIMESTAMP WITH TIME ZONE, "publicadoEn" TIMESTAMP WITH TIME ZONE, "creadoPorId" character varying NOT NULL, "creadoEn" TIMESTAMP NOT NULL DEFAULT now(), "actualizadoEn" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_publicaciones_redes_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_publicaciones_redes_estado" ON "publicaciones_redes" ("estado") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_publicaciones_redes_estado"`);
        await queryRunner.query(`DROP TABLE "publicaciones_redes"`);
    }

}
