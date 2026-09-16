import { MigrationInterface, QueryRunner } from "typeorm";

export class AgregaGastos1789509856610 implements MigrationInterface {
    name = 'AgregaGastos1789509856610'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "gastos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "expedienteId" character varying NOT NULL, "concepto" character varying NOT NULL, "monto" numeric(12,2) NOT NULL, "fecha" date NOT NULL, "facturadoAlCliente" boolean NOT NULL DEFAULT false, "notas" text, "registradoPorId" character varying NOT NULL, "creadoEn" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_gastos_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_gastos_expedienteId" ON "gastos" ("expedienteId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_gastos_expedienteId"`);
        await queryRunner.query(`DROP TABLE "gastos"`);
    }

}
