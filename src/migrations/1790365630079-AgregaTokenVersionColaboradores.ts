import { MigrationInterface, QueryRunner } from "typeorm";

export class AgregaTokenVersionColaboradores1790365630079 implements MigrationInterface {
    name = 'AgregaTokenVersionColaboradores1790365630079'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "colaboradores" ADD "tokenVersion" integer NOT NULL DEFAULT 0`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "colaboradores" DROP COLUMN "tokenVersion"`);
    }

}
