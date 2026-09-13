import { MigrationInterface, QueryRunner } from "typeorm";

export class AgregaVerificacionCitasSolicitudDocumento1788825950792 implements MigrationInterface {
    name = 'AgregaVerificacionCitasSolicitudDocumento1788825950792'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "solicitudes_documento" ADD "citasVerificadas" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "solicitudes_documento" ADD "citasVerificadasPorId" character varying`);
        await queryRunner.query(`ALTER TABLE "solicitudes_documento" ADD "citasVerificadasEn" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "solicitudes_documento" DROP COLUMN "citasVerificadasEn"`);
        await queryRunner.query(`ALTER TABLE "solicitudes_documento" DROP COLUMN "citasVerificadasPorId"`);
        await queryRunner.query(`ALTER TABLE "solicitudes_documento" DROP COLUMN "citasVerificadas"`);
    }

}
