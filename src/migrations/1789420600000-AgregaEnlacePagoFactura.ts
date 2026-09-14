import { MigrationInterface, QueryRunner } from "typeorm";

export class AgregaEnlacePagoFactura1789420600000 implements MigrationInterface {
    name = 'AgregaEnlacePagoFactura1789420600000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "facturas" ADD "enlacePago" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "facturas" DROP COLUMN "enlacePago"`);
    }
}
