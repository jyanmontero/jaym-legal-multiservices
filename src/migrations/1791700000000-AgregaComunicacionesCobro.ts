import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Registro de cada cotización, factura, recordatorio o recibo que se envía
 * (o se prepara para enviar) al cliente por correo o WhatsApp. Es un
 * registro de solo agregar: sirve de constancia de cuándo y qué se le envió.
 */
export class AgregaComunicacionesCobro1791700000000 implements MigrationInterface {
  name = 'AgregaComunicacionesCobro1791700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "comunicaciones_cobro" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tipo" character varying NOT NULL,
        "canal" character varying NOT NULL,
        "clienteId" character varying NOT NULL,
        "expedienteId" character varying,
        "facturaId" character varying,
        "cotizacionId" character varying,
        "destinatario" character varying NOT NULL,
        "asunto" character varying,
        "contenido" text NOT NULL,
        "adjunto" character varying,
        "estado" character varying NOT NULL,
        "error" text,
        "enviadoPorId" character varying,
        "creadoEn" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_comunicaciones_cobro" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_comcobro_factura" ON "comunicaciones_cobro" ("facturaId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_comcobro_cotizacion" ON "comunicaciones_cobro" ("cotizacionId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_comcobro_cliente" ON "comunicaciones_cobro" ("clienteId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "comunicaciones_cobro"`);
  }
}
