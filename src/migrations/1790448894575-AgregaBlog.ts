import { MigrationInterface, QueryRunner } from "typeorm";

export class AgregaBlog1790448894575 implements MigrationInterface {
    name = 'AgregaBlog1790448894575'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."blog_posts_areapractica_enum" AS ENUM('civil', 'comercial', 'penal', 'laboral', 'familia', 'inmobiliario', 'migratorio', 'administrativo', 'constitucional', 'registro_civil_jce', 'notarial', 'corporativo', 'propiedad_intelectual', 'cobros', 'proteccion_consumidor', 'seguridad_social', 'otra')`);
        await queryRunner.query(`CREATE TYPE "public"."blog_posts_estado_enum" AS ENUM('borrador', 'programado', 'publicado', 'fallido')`);
        await queryRunner.query(`CREATE TABLE "blog_posts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "titulo" character varying NOT NULL, "contenidoHtml" text NOT NULL DEFAULT '', "extracto" text, "areaPractica" "public"."blog_posts_areapractica_enum", "temaOriginal" text, "imagenDestacadaClave" character varying, "fechaProgramada" date, "estado" "public"."blog_posts_estado_enum" NOT NULL DEFAULT 'borrador', "wordpressPostId" integer, "wordpressEnlace" character varying, "publicadoEn" TIMESTAMP WITH TIME ZONE, "motivoFallo" text, "creadoPorId" character varying NOT NULL, "creadoEn" TIMESTAMP NOT NULL DEFAULT now(), "actualizadoEn" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_blog_posts_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_blog_posts_estado" ON "blog_posts" ("estado") `);
        await queryRunner.query(`CREATE INDEX "IDX_blog_posts_creadoPorId" ON "blog_posts" ("creadoPorId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_blog_posts_creadoPorId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_blog_posts_estado"`);
        await queryRunner.query(`DROP TABLE "blog_posts"`);
        await queryRunner.query(`DROP TYPE "public"."blog_posts_estado_enum"`);
        await queryRunner.query(`DROP TYPE "public"."blog_posts_areapractica_enum"`);
    }

}
