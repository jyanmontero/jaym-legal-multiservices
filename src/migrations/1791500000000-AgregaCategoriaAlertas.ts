import { MigrationInterface, QueryRunner } from "typeorm";

export class AgregaCategoriaAlertas1791500000000 implements MigrationInterface {
    name = 'AgregaCategoriaAlertas1791500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "alertas" ADD COLUMN IF NOT EXISTS "categoria" character varying NOT NULL DEFAULT 'otros'`);
        // Alertas ya existentes: categoría según la regla y, para las de agenda, según el tipo de evento.
        await queryRunner.query(`UPDATE "alertas" SET "categoria" = CASE "tipoRegla"::text
            WHEN 'factura_vencida' THEN 'cobros'
            WHEN 'plazo_proximo' THEN 'plazos'
            WHEN 'plazo_vencido' THEN 'plazos'
            WHEN 'documento_vencido' THEN 'documentos'
            WHEN 'requisito_pendiente_vencido' THEN 'requisitos'
            WHEN 'expediente_sin_movimiento' THEN 'seguimiento'
            ELSE "categoria" END`);
        await queryRunner.query(`UPDATE "alertas" a SET "categoria" = CASE e."tipo"::text
            WHEN 'audiencia' THEN 'audiencias'
            WHEN 'reunion' THEN 'reuniones' WHEN 'cita' THEN 'reuniones' WHEN 'llamada' THEN 'reuniones'
            WHEN 'deposito' THEN 'depositos'
            WHEN 'vencimiento' THEN 'plazos' WHEN 'plazo_judicial' THEN 'plazos'
            ELSE 'seguimiento' END,
            "expedienteId" = COALESCE(a."expedienteId", e."expedienteId"::text),
            "clienteId" = COALESCE(a."clienteId", e."clienteId"::text)
          FROM "agenda_eventos" e WHERE a."agendaEventoId" = e."id"::text`);
        await queryRunner.query(`UPDATE "alertas" a SET "expedienteId" = COALESCE(a."expedienteId", f."expedienteId"::text), "clienteId" = COALESCE(a."clienteId", f."clienteId"::text)
          FROM "facturas" f WHERE a."facturaId" = f."id"::text`);
        await queryRunner.query(`UPDATE "alertas" a SET "expedienteId" = COALESCE(a."expedienteId", d."expedienteId"::text), "clienteId" = COALESCE(a."clienteId", d."clienteId"::text)
          FROM "documentos" d WHERE a."documentoId" = d."id"::text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "alertas" DROP COLUMN IF EXISTS "categoria"`);
    }

}
