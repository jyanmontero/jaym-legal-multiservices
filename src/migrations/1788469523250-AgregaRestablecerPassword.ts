import { MigrationInterface, QueryRunner } from "typeorm";

export class AgregaRestablecerPassword1788469523250 implements MigrationInterface {
    name = 'AgregaRestablecerPassword1788469523250'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "password_reset_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "usuarioId" character varying NOT NULL, "tokenHash" character varying NOT NULL, "expiraEn" TIMESTAMP NOT NULL, "usadoEn" TIMESTAMP, "creadoEn" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d16bebd73e844c48bca50ff8d3d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1143abb8c3fad8b06dd857a8c9" ON "password_reset_tokens"  ("tokenHash") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_1143abb8c3fad8b06dd857a8c9"`);
        await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
    }

}
