import { MigrationInterface, QueryRunner } from "typeorm";

export class AgregaMarketingInmobiliario1789942824369 implements MigrationInterface {
    name = 'AgregaMarketingInmobiliario1789942824369'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."anuncios_propiedades_estado_enum" AS ENUM('borrador', 'publicado')`);
        await queryRunner.query(`CREATE TABLE "anuncios_propiedades" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "titulo" character varying NOT NULL, "zona" character varying, "habitaciones" integer, "banos" integer, "metrosCuadrados" numeric(10,2), "precio" numeric(14,2) NOT NULL, "moneda" character varying NOT NULL DEFAULT 'RD$', "notas" text, "contacto" text, "fotosClaves" text array NOT NULL DEFAULT '{}', "textoAnuncio" text, "mensajeWhatsapp" text, "estado" "public"."anuncios_propiedades_estado_enum" NOT NULL DEFAULT 'borrador', "facebookPostId" character varying, "instagramMediaId" character varying, "publicadoEn" TIMESTAMP WITH TIME ZONE, "creadoPorId" character varying NOT NULL, "creadoEn" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_anuncios_propiedades_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_anuncios_propiedades_creadoPorId" ON "anuncios_propiedades" ("creadoPorId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_anuncios_propiedades_creadoPorId"`);
        await queryRunner.query(`DROP TABLE "anuncios_propiedades"`);
        await queryRunner.query(`DROP TYPE "public"."anuncios_propiedades_estado_enum"`);
    }

}
