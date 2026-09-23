import { MigrationInterface, QueryRunner } from "typeorm";

export class AgregaPublicacionPortalInmobiliario1790133095531 implements MigrationInterface {
    name = 'AgregaPublicacionPortalInmobiliario1790133095531'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "anuncios_propiedades" ADD "wordpressPostId" integer`);
        await queryRunner.query(`ALTER TABLE "anuncios_propiedades" ADD "wordpressEnlace" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "anuncios_propiedades" DROP COLUMN "wordpressEnlace"`);
        await queryRunner.query(`ALTER TABLE "anuncios_propiedades" DROP COLUMN "wordpressPostId"`);
    }

}
