import { MigrationInterface, QueryRunner } from "typeorm";

export class AgregaPermisosPersonalizadosUsuario1789402069787 implements MigrationInterface {
    name = 'AgregaPermisosPersonalizadosUsuario1789402069787'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuarios" ADD "permisosPersonalizados" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN "permisosPersonalizados"`);
    }

}
