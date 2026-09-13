import { MigrationInterface, QueryRunner } from "typeorm";

export class AgregaRecordatorioEnviado1788477802238 implements MigrationInterface {
    name = 'AgregaRecordatorioEnviado1788477802238'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "agenda_eventos" ADD "recordatorioEnviado" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "agenda_eventos" DROP COLUMN "recordatorioEnviado"`);
    }

}
