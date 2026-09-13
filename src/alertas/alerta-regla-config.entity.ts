import { Entity, PrimaryColumn, Column } from 'typeorm';
import { TipoReglaAlerta, SeveridadAlerta } from '../common/enums/index.js';

/**
 * Configuración por tipo de regla — permite al administrador ajustar
 * sensibilidad (ej. "sin movimiento" = 15 días) sin tocar código, tal
 * como pide la sección 14. Se siembra con valores por defecto al arrancar
 * (ver AlertasService.onModuleInit).
 */
@Entity('alertas_reglas_config')
export class AlertaReglaConfig {
  @PrimaryColumn({ type: 'enum', enum: TipoReglaAlerta })
  tipoRegla: TipoReglaAlerta;

  @Column({ default: true })
  activa: boolean;

  @Column('int', { nullable: true })
  umbralDias?: number;

  @Column({ type: 'enum', enum: SeveridadAlerta })
  severidadDefault: SeveridadAlerta;
}
