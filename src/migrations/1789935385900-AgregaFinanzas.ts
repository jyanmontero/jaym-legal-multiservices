import { MigrationInterface, QueryRunner } from "typeorm";

export class AgregaFinanzas1789935385900 implements MigrationInterface {
    name = 'AgregaFinanzas1789935385900'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."categorias_financieras_tipo_enum" AS ENUM('ingreso', 'gasto')`);
        await queryRunner.query(`CREATE TABLE "categorias_financieras" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nombre" character varying NOT NULL, "tipo" "public"."categorias_financieras_tipo_enum" NOT NULL, "presupuestoMensual" numeric(12,2), "activa" boolean NOT NULL DEFAULT true, "creadoEn" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_categorias_financieras_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_categorias_financieras_tipo" ON "categorias_financieras" ("tipo") `);

        await queryRunner.query(`CREATE TYPE "public"."movimientos_financieros_tipo_enum" AS ENUM('ingreso', 'gasto')`);
        await queryRunner.query(`CREATE TYPE "public"."movimientos_financieros_metodoPago_enum" AS ENUM('efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro')`);
        await queryRunner.query(`CREATE TABLE "movimientos_financieros" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tipo" "public"."movimientos_financieros_tipo_enum" NOT NULL, "categoriaId" character varying NOT NULL, "concepto" character varying NOT NULL, "monto" numeric(12,2) NOT NULL, "fecha" date NOT NULL, "metodoPago" "public"."movimientos_financieros_metodoPago_enum", "notas" text, "registradoPorId" character varying NOT NULL, "creadoEn" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_movimientos_financieros_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_movimientos_financieros_tipo_fecha" ON "movimientos_financieros" ("tipo", "fecha") `);
        await queryRunner.query(`CREATE INDEX "IDX_movimientos_financieros_categoriaId" ON "movimientos_financieros" ("categoriaId") `);

        // Categorías por defecto, con presupuesto mensual de referencia en
        // RD$ -- las mismas que se prepararon en la hoja de cálculo de
        // Control de Gastos para la firma. Editables/desactivables desde la
        // pestaña "Categorías" una vez desplegado.
        await queryRunner.query(`
          INSERT INTO "categorias_financieras" ("nombre", "tipo", "presupuestoMensual") VALUES
            ('Nómina y salarios', 'gasto', 90000),
            ('Alquiler de oficina', 'gasto', 35000),
            ('Servicios (luz, agua, internet, teléfono)', 'gasto', 12000),
            ('Suministros de oficina', 'gasto', 5000),
            ('Software y licencias', 'gasto', 8000),
            ('Marketing y publicidad', 'gasto', 15000),
            ('Cuotas profesionales (Colegio de Abogados, CARD)', 'gasto', 3000),
            ('Transporte y combustible', 'gasto', 10000),
            ('Mantenimiento y reparaciones', 'gasto', 4000),
            ('Seguros', 'gasto', 6000),
            ('Impuestos y tasas', 'gasto', 10000),
            ('Gastos de expediente (sellos, timbres, notificaciones, peritos)', 'gasto', 20000),
            ('Capacitación y formación', 'gasto', 4000),
            ('Otros gastos', 'gasto', 5000),
            ('Honorarios profesionales', 'ingreso', NULL),
            ('Anticipos de clientes', 'ingreso', NULL),
            ('Consultas', 'ingreso', NULL),
            ('Otros ingresos', 'ingreso', NULL)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_movimientos_financieros_categoriaId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_movimientos_financieros_tipo_fecha"`);
        await queryRunner.query(`DROP TABLE "movimientos_financieros"`);
        await queryRunner.query(`DROP TYPE "public"."movimientos_financieros_metodoPago_enum"`);
        await queryRunner.query(`DROP TYPE "public"."movimientos_financieros_tipo_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_categorias_financieras_tipo"`);
        await queryRunner.query(`DROP TABLE "categorias_financieras"`);
        await queryRunner.query(`DROP TYPE "public"."categorias_financieras_tipo_enum"`);
    }

}
