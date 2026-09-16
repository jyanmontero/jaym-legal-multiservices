import { MigrationInterface, QueryRunner } from "typeorm";

export class AgregaPortalCliente1789512219307 implements MigrationInterface {
    name = 'AgregaPortalCliente1789512219307'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "portal_usuarios" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "clienteId" character varying NOT NULL, "nombreCompleto" character varying NOT NULL, "correo" character varying NOT NULL, "passwordHash" character varying NOT NULL, "activo" boolean NOT NULL DEFAULT true, "debeCambiarPassword" boolean NOT NULL DEFAULT true, "ultimoAcceso" TIMESTAMP, "intentosFallidosLogin" integer NOT NULL DEFAULT 0, "bloqueadoHastaLogin" TIMESTAMP, "creadoPorId" character varying, "creadoEn" TIMESTAMP NOT NULL DEFAULT now(), "actualizadoEn" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_portal_usuarios_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_portal_usuarios_correo" ON "portal_usuarios" ("correo") `);
        await queryRunner.query(`CREATE INDEX "IDX_portal_usuarios_clienteId" ON "portal_usuarios" ("clienteId") `);

        await queryRunner.query(`CREATE TABLE "portal_password_reset_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "portalUsuarioId" character varying NOT NULL, "tokenHash" character varying NOT NULL, "expiraEn" TIMESTAMP NOT NULL, "usadoEn" TIMESTAMP, "creadoEn" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_portal_password_reset_tokens_tokenHash" UNIQUE ("tokenHash"), CONSTRAINT "PK_portal_password_reset_tokens_id" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE TABLE "mensajes_portal" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "clienteId" character varying NOT NULL, "expedienteId" character varying, "remitenteTipo" character varying(10) NOT NULL, "remitenteId" character varying NOT NULL, "contenido" text NOT NULL, "leidoEn" TIMESTAMP, "creadoEn" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_mensajes_portal_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_mensajes_portal_cliente_exp_fecha" ON "mensajes_portal" ("clienteId", "expedienteId", "creadoEn") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_mensajes_portal_cliente_exp_fecha"`);
        await queryRunner.query(`DROP TABLE "mensajes_portal"`);
        await queryRunner.query(`DROP TABLE "portal_password_reset_tokens"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_portal_usuarios_clienteId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_portal_usuarios_correo"`);
        await queryRunner.query(`DROP TABLE "portal_usuarios"`);
    }

}
