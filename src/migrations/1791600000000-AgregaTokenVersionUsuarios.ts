import { MigrationInterface, QueryRunner } from 'typeorm';

export class AgregaTokenVersionUsuarios1791600000000 implements MigrationInterface {
  name = 'AgregaTokenVersionUsuarios1791600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "tokenVersion" integer NOT NULL DEFAULT 0`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "usuarios" DROP COLUMN IF EXISTS "tokenVersion"`);
  }
}
