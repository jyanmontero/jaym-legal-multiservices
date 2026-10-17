import { MigrationInterface, QueryRunner } from 'typeorm';

export class AgregaComprasFiscales1791800000000 implements MigrationInterface {
  name = 'AgregaComprasFiscales1791800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."compras_fiscales_origen_enum" AS ENUM('manual', 'lectura_ia')`);
    await queryRunner.query(`CREATE TYPE "public"."compras_fiscales_estado_enum" AS ENUM('confirmada', 'anulada')`);
    await queryRunner.query(`CREATE TABLE "compras_fiscales" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "proveedorNombre" character varying NOT NULL,
      "proveedorIdentificacion" character varying NOT NULL,
      "tipoIdentificacion" smallint NOT NULL,
      "ncf" character varying NOT NULL,
      "ncfModificado" character varying,
      "fechaComprobante" date NOT NULL,
      "fechaPago" date,
      "tipoBienesServicios" smallint NOT NULL,
      "formaPago" smallint NOT NULL DEFAULT '2',
      "montoServicios" numeric(14,2) NOT NULL DEFAULT '0',
      "montoBienes" numeric(14,2) NOT NULL DEFAULT '0',
      "itbisFacturado" numeric(14,2) NOT NULL DEFAULT '0',
      "itbisAlCosto" numeric(14,2) NOT NULL DEFAULT '0',
      "itbisRetenido" numeric(14,2) NOT NULL DEFAULT '0',
      "tipoRetencionIsr" smallint,
      "retencionRenta" numeric(14,2) NOT NULL DEFAULT '0',
      "isc" numeric(14,2) NOT NULL DEFAULT '0',
      "otrosImpuestos" numeric(14,2) NOT NULL DEFAULT '0',
      "propinaLegal" numeric(14,2) NOT NULL DEFAULT '0',
      "total" numeric(14,2) NOT NULL,
      "moneda" character varying NOT NULL DEFAULT 'DOP',
      "concepto" text,
      "expedienteId" character varying,
      "origen" "public"."compras_fiscales_origen_enum" NOT NULL DEFAULT 'manual',
      "archivoClave" character varying,
      "archivoNombreOriginal" character varying,
      "archivoMime" character varying,
      "archivoSha256" character varying,
      "estado" "public"."compras_fiscales_estado_enum" NOT NULL DEFAULT 'confirmada',
      "motivoAnulacion" text,
      "anuladaEn" TIMESTAMP,
      "anuladaPorId" character varying,
      "registradaPorId" character varying NOT NULL,
      "creadoEn" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_compras_fiscales_id" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(`CREATE INDEX "IDX_compras_fiscales_fechaComprobante" ON "compras_fiscales" ("fechaComprobante")`);
    await queryRunner.query(`CREATE INDEX "IDX_compras_fiscales_archivoSha256" ON "compras_fiscales" ("archivoSha256")`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_compra_proveedor_ncf_vigente" ON "compras_fiscales" ("proveedorIdentificacion", "ncf") WHERE "estado" = 'confirmada'`,
    );

    await queryRunner.query(`CREATE TABLE "compras_fiscales_historial" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "compraId" character varying NOT NULL,
      "accion" character varying NOT NULL,
      "snapshot" jsonb NOT NULL,
      "motivo" text,
      "usuarioId" character varying NOT NULL,
      "creadoEn" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_compras_fiscales_historial_id" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(`CREATE INDEX "IDX_compras_fiscales_historial_compraId" ON "compras_fiscales_historial" ("compraId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_compras_fiscales_historial_compraId"`);
    await queryRunner.query(`DROP TABLE "compras_fiscales_historial"`);
    await queryRunner.query(`DROP INDEX "public"."idx_compra_proveedor_ncf_vigente"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_compras_fiscales_archivoSha256"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_compras_fiscales_fechaComprobante"`);
    await queryRunner.query(`DROP TABLE "compras_fiscales"`);
    await queryRunner.query(`DROP TYPE "public"."compras_fiscales_estado_enum"`);
    await queryRunner.query(`DROP TYPE "public"."compras_fiscales_origen_enum"`);
  }
}
