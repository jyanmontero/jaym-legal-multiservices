import { MigrationInterface, QueryRunner } from "typeorm";

export class AgregaBloqueoLoginUsuario1789412703991 implements MigrationInterface {
    name = 'AgregaBloqueoLoginUsuario1789412703991'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuarios" ADD "intentosFallidosLogin" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "usuarios" ADD "bloqueadoHastaLogin" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN "bloqueadoHastaLogin"`);
        await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN "intentosFallidosLogin"`);
    }

}
