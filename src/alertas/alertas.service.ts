import { ForbiddenException, Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, In, LessThan, Repository } from 'typeorm';
import { Alerta } from './alerta.entity.js';
import { AlertaReglaConfig } from './alerta-regla-config.entity.js';
import { Expediente } from '../expedientes/expediente.entity.js';
import { Documento } from '../documentos/documento.entity.js';
import { ExpedienteRequisito } from '../requisitos/expediente-requisito.entity.js';
import { AgendaEvento } from '../agenda/agenda-evento.entity.js';
import { Factura } from '../facturacion/factura.entity.js';
import {
  TipoReglaAlerta,
  SeveridadAlerta,
  EstadoExpediente,
  EstadoRequisito,
  EstadoEventoAgenda,
  EstadoFactura,
  RolUsuario,
  ROLES_CON_VISIBILIDAD_TOTAL_EXPEDIENTES,
} from '../common/enums/index.js';

// Datos mínimos del usuario autenticado -- misma forma que UsuarioActual en
// ExpedientesService, pero declarada localmente para no crear una
// dependencia hacia ese módulo (aquí basta con el repositorio de
// Expediente, ya registrado en AlertasModule para las reglas del motor).
interface UsuarioActualAlertas {
  id: string;
  rol: RolUsuario;
}

type CampoEntidad = 'expedienteId' | 'documentoId' | 'agendaEventoId' | 'facturaId';

interface CandidatoAlerta {
  entidadId: string; // valor que va en el campo FK (expedienteId, documentoId, etc.)
  mensaje: string;
  severidad: SeveridadAlerta;
}

const ESTADOS_EXPEDIENTE_CERRADOS = [
  EstadoExpediente.CERRADO_FAVORABLE,
  EstadoExpediente.CERRADO_DESFAVORABLE,
  EstadoExpediente.ARCHIVADO,
];

const CONFIG_POR_DEFECTO: Array<{
  tipoRegla: TipoReglaAlerta;
  umbralDias?: number;
  severidadDefault: SeveridadAlerta;
}> = [
  { tipoRegla: TipoReglaAlerta.EXPEDIENTE_SIN_MOVIMIENTO, umbralDias: 15, severidadDefault: SeveridadAlerta.ATENCION },
  { tipoRegla: TipoReglaAlerta.PLAZO_PROXIMO, umbralDias: 5, severidadDefault: SeveridadAlerta.ATENCION },
  { tipoRegla: TipoReglaAlerta.PLAZO_VENCIDO, umbralDias: 0, severidadDefault: SeveridadAlerta.CRITICA },
  { tipoRegla: TipoReglaAlerta.DOCUMENTO_VENCIDO, umbralDias: 0, severidadDefault: SeveridadAlerta.ATENCION },
  { tipoRegla: TipoReglaAlerta.REQUISITO_PENDIENTE_VENCIDO, umbralDias: 0, severidadDefault: SeveridadAlerta.ATENCION },
  { tipoRegla: TipoReglaAlerta.EVENTO_PROXIMO, umbralDias: 1, severidadDefault: SeveridadAlerta.INFORMATIVA },
  { tipoRegla: TipoReglaAlerta.EVENTO_VENCIDO, umbralDias: 0, severidadDefault: SeveridadAlerta.URGENTE },
  { tipoRegla: TipoReglaAlerta.FACTURA_VENCIDA, umbralDias: 0, severidadDefault: SeveridadAlerta.URGENTE },
];

@Injectable()
export class AlertasService implements OnModuleInit {
  private readonly logger = new Logger(AlertasService.name);

  constructor(
    @InjectRepository(Alerta) private readonly alertaRepo: Repository<Alerta>,
    @InjectRepository(AlertaReglaConfig)
    private readonly configRepo: Repository<AlertaReglaConfig>,
    @InjectRepository(Expediente) private readonly expedienteRepo: Repository<Expediente>,
    @InjectRepository(Documento) private readonly documentoRepo: Repository<Documento>,
    @InjectRepository(ExpedienteRequisito)
    private readonly requisitoRepo: Repository<ExpedienteRequisito>,
    @InjectRepository(AgendaEvento) private readonly eventoRepo: Repository<AgendaEvento>,
    @InjectRepository(Factura) private readonly facturaRepo: Repository<Factura>,
  ) {}

  /** Siembra la configuración por defecto la primera vez que arranca el sistema. */
  async onModuleInit() {
    for (const defecto of CONFIG_POR_DEFECTO) {
      const existente = await this.configRepo.findOne({ where: { tipoRegla: defecto.tipoRegla } });
      if (!existente) {
        await this.configRepo.save(this.configRepo.create(defecto));
      }
    }
  }

  async listarConfig(): Promise<AlertaReglaConfig[]> {
    return this.configRepo.find();
  }

  async actualizarConfig(
    tipoRegla: TipoReglaAlerta,
    cambios: Partial<Pick<AlertaReglaConfig, 'activa' | 'umbralDias' | 'severidadDefault'>>,
  ): Promise<AlertaReglaConfig> {
    await this.configRepo.update(tipoRegla, cambios);
    return this.configRepo.findOneByOrFail({ tipoRegla });
  }

  /**
   * Sin usuarioActual (llamadas internas) devuelve todo, igual que antes.
   * Con usuarioActual, aplica la regla documentada en el campo
   * usuarioDestinatarioId de la entidad Alerta ("nulo = visible para todo
   * el que tenga acceso al expediente asociado"): visible si la alerta es
   * suya explícitamente, o si no tiene destinatario y (no está ligada a un
   * expediente, o el expediente le pertenece / no tiene responsable).
   */
  async listar(
    filtros: {
      resuelta?: boolean;
      severidad?: SeveridadAlerta;
      expedienteId?: string;
    },
    usuarioActual?: UsuarioActualAlertas,
  ): Promise<Alerta[]> {
    const qb = this.alertaRepo.createQueryBuilder('a');
    if (filtros.resuelta !== undefined) qb.andWhere('a.resuelta = :r', { r: filtros.resuelta });
    if (filtros.severidad) qb.andWhere('a.severidad = :s', { s: filtros.severidad });
    if (filtros.expedienteId) qb.andWhere('a.expedienteId = :e', { e: filtros.expedienteId });

    if (usuarioActual && !ROLES_CON_VISIBILIDAD_TOTAL_EXPEDIENTES.includes(usuarioActual.rol)) {
      qb.leftJoin('expedientes', 'exp', 'exp.id = a."expedienteId"');
      qb.andWhere(
        '(a."usuarioDestinatarioId" = :miId OR (a."usuarioDestinatarioId" IS NULL AND (a."expedienteId" IS NULL OR exp."abogadoResponsableId" = :miId OR exp."abogadoResponsableId" IS NULL)))',
        { miId: usuarioActual.id },
      );
    }

    return qb.orderBy('a.creadoEn', 'DESC').getMany();
  }

  /** Misma regla de visibilidad que listar(), evaluada para una sola alerta. */
  private async esVisiblePorUsuario(
    alerta: Alerta,
    usuarioActual: UsuarioActualAlertas,
  ): Promise<boolean> {
    if (ROLES_CON_VISIBILIDAD_TOTAL_EXPEDIENTES.includes(usuarioActual.rol)) return true;
    if (alerta.usuarioDestinatarioId) return alerta.usuarioDestinatarioId === usuarioActual.id;
    if (!alerta.expedienteId) return true;
    const expediente = await this.expedienteRepo.findOne({ where: { id: alerta.expedienteId } });
    if (!expediente) return true; // referencia huérfana -- no ocultar por un problema de datos
    return !expediente.abogadoResponsableId || expediente.abogadoResponsableId === usuarioActual.id;
  }

  async marcarVista(id: string, usuarioActual?: UsuarioActualAlertas): Promise<void> {
    if (usuarioActual) {
      const alerta = await this.alertaRepo.findOne({ where: { id } });
      if (!alerta) throw new NotFoundException('Alerta no encontrada');
      if (!(await this.esVisiblePorUsuario(alerta, usuarioActual))) {
        throw new ForbiddenException('Esta alerta no te pertenece.');
      }
    }
    await this.alertaRepo.update(id, { vista: true, vistaEn: new Date() });
  }

  /**
   * Punto de entrada del motor de reglas. Se ejecuta por cron (ver
   * AlertasScheduler) y también puede dispararse manualmente vía
   * POST /alertas/generar para pruebas o ejecución bajo demanda.
   */
  async generarAlertas(): Promise<{ creadas: number; resueltas: number; nuevas: Alerta[] }> {
    let creadas = 0;
    let resueltas = 0;
    let nuevas: Alerta[] = [];

    const resultados = await Promise.all([
      this.evaluarExpedientesSinMovimiento(),
      this.evaluarPlazos(),
      this.evaluarDocumentosVencidos(),
      this.evaluarRequisitosPendientesVencidos(),
      this.evaluarEventosAgenda(),
      this.evaluarFacturasVencidas(),
    ]);

    for (const r of resultados) {
      creadas += r.creadas;
      resueltas += r.resueltas;
      nuevas = nuevas.concat(r.nuevas);
    }

    this.logger.log(`Motor de alertas: ${creadas} creadas, ${resueltas} resueltas`);
    return { creadas, resueltas, nuevas };
  }

  // --- Reglas individuales ---

  private async evaluarExpedientesSinMovimiento() {
    const config = await this.configRepo.findOne({
      where: { tipoRegla: TipoReglaAlerta.EXPEDIENTE_SIN_MOVIMIENTO },
    });
    if (!config?.activa) return { creadas: 0, resueltas: 0, nuevas: [] as Alerta[] };

    const limite = new Date();
    limite.setDate(limite.getDate() - (config.umbralDias ?? 15));

    const expedientes = await this.expedienteRepo.find({
      where: {
        actualizadoEn: LessThan(limite),
        estado: Not(In(ESTADOS_EXPEDIENTE_CERRADOS)),
      },
    });

    const candidatos: CandidatoAlerta[] = expedientes.map((e) => ({
      entidadId: e.id,
      mensaje: `El expediente ${e.codigo} no tiene actualizaciones desde hace más de ${config.umbralDias} días.`,
      severidad: config.severidadDefault,
    }));

    return this.sincronizar(TipoReglaAlerta.EXPEDIENTE_SIN_MOVIMIENTO, 'expedienteId', candidatos);
  }

  private async evaluarPlazos() {
    const [configProximo, configVencido] = await Promise.all([
      this.configRepo.findOne({ where: { tipoRegla: TipoReglaAlerta.PLAZO_PROXIMO } }),
      this.configRepo.findOne({ where: { tipoRegla: TipoReglaAlerta.PLAZO_VENCIDO } }),
    ]);

    const hoy = new Date().toISOString().slice(0, 10);
    const expedientesActivos = await this.expedienteRepo.find({
      where: { estado: Not(In(ESTADOS_EXPEDIENTE_CERRADOS)) },
    });

    let resultado = { creadas: 0, resueltas: 0, nuevas: [] as Alerta[] };

    if (configVencido?.activa) {
      const vencidos = expedientesActivos.filter((e) => e.fechaLimite && e.fechaLimite < hoy);
      const candidatos: CandidatoAlerta[] = vencidos.map((e) => ({
        entidadId: e.id,
        mensaje: `El expediente ${e.codigo} tiene un plazo límite vencido (${e.fechaLimite}).`,
        severidad: configVencido.severidadDefault,
      }));
      const r = await this.sincronizar(TipoReglaAlerta.PLAZO_VENCIDO, 'expedienteId', candidatos);
      resultado.creadas += r.creadas;
      resultado.resueltas += r.resueltas;
      resultado.nuevas = resultado.nuevas.concat(r.nuevas);
    }

    if (configProximo?.activa) {
      const limiteProximo = new Date();
      limiteProximo.setDate(limiteProximo.getDate() + (configProximo.umbralDias ?? 5));
      const limiteProximoStr = limiteProximo.toISOString().slice(0, 10);

      const proximos = expedientesActivos.filter(
        (e) => e.fechaLimite && e.fechaLimite >= hoy && e.fechaLimite <= limiteProximoStr,
      );
      const candidatos: CandidatoAlerta[] = proximos.map((e) => ({
        entidadId: e.id,
        mensaje: `El expediente ${e.codigo} tiene un plazo límite próximo (${e.fechaLimite}).`,
        severidad: configProximo.severidadDefault,
      }));
      const r = await this.sincronizar(TipoReglaAlerta.PLAZO_PROXIMO, 'expedienteId', candidatos);
      resultado.creadas += r.creadas;
      resultado.resueltas += r.resueltas;
      resultado.nuevas = resultado.nuevas.concat(r.nuevas);
    }

    return resultado;
  }

  private async evaluarDocumentosVencidos() {
    const config = await this.configRepo.findOne({
      where: { tipoRegla: TipoReglaAlerta.DOCUMENTO_VENCIDO },
    });
    if (!config?.activa) return { creadas: 0, resueltas: 0, nuevas: [] as Alerta[] };

    const hoy = new Date().toISOString().slice(0, 10);
    const documentos = await this.documentoRepo
      .createQueryBuilder('d')
      .where('d.fechaVencimiento IS NOT NULL')
      .andWhere('d.fechaVencimiento < :hoy', { hoy })
      .andWhere('d.eliminadoEn IS NULL')
      .getMany();

    const candidatos: CandidatoAlerta[] = documentos.map((d) => ({
      entidadId: d.id,
      mensaje: `El documento "${d.nombreArchivo}" está vencido desde el ${d.fechaVencimiento}.`,
      severidad: config.severidadDefault,
    }));

    return this.sincronizar(TipoReglaAlerta.DOCUMENTO_VENCIDO, 'documentoId', candidatos);
  }

  private async evaluarRequisitosPendientesVencidos() {
    const config = await this.configRepo.findOne({
      where: { tipoRegla: TipoReglaAlerta.REQUISITO_PENDIENTE_VENCIDO },
    });
    if (!config?.activa) return { creadas: 0, resueltas: 0, nuevas: [] as Alerta[] };

    const hoy = new Date().toISOString().slice(0, 10);
    const requisitos = await this.requisitoRepo
      .createQueryBuilder('r')
      .where('r.obligatorio = true')
      .andWhere('r.estado NOT IN (:...estados)', {
        estados: [EstadoRequisito.COMPLETO, EstadoRequisito.NO_APLICA],
      })
      .andWhere('r.fechaPrometida IS NOT NULL')
      .andWhere('r.fechaPrometida < :hoy', { hoy })
      .getMany();

    // La alerta se asocia al expediente (no hay campo requisitoId en Alerta,
    // ya que el modelo de datos original la vincula por expediente).
    const candidatos: CandidatoAlerta[] = requisitos.map((r) => ({
      entidadId: r.expedienteId,
      mensaje: `El requisito "${r.nombreRequisito}" está pendiente y venció su fecha prometida (${r.fechaPrometida}).`,
      severidad: config.severidadDefault,
    }));

    return this.sincronizar(TipoReglaAlerta.REQUISITO_PENDIENTE_VENCIDO, 'expedienteId', candidatos);
  }

  private async evaluarFacturasVencidas() {
    const config = await this.configRepo.findOne({
      where: { tipoRegla: TipoReglaAlerta.FACTURA_VENCIDA },
    });
    if (!config?.activa) return { creadas: 0, resueltas: 0, nuevas: [] as Alerta[] };

    const hoy = new Date().toISOString().slice(0, 10);
    const facturas = await this.facturaRepo
      .createQueryBuilder('f')
      .where('f.estado IN (:...estados)', {
        estados: [EstadoFactura.PENDIENTE, EstadoFactura.PAGADA_PARCIAL],
      })
      .andWhere('f.fechaVencimiento IS NOT NULL')
      .andWhere('f.fechaVencimiento < :hoy', { hoy })
      .getMany();

    const candidatos: CandidatoAlerta[] = facturas.map((f) => ({
      entidadId: f.id,
      mensaje: `La factura ${f.numero} está vencida desde el ${f.fechaVencimiento} con un saldo de RD$ ${(Number(f.total) - Number(f.montoPagado)).toFixed(2)}.`,
      severidad: config.severidadDefault,
    }));

    return this.sincronizar(TipoReglaAlerta.FACTURA_VENCIDA, 'facturaId', candidatos);
  }

  private async evaluarEventosAgenda() {
    const [configProximo, configVencido] = await Promise.all([
      this.configRepo.findOne({ where: { tipoRegla: TipoReglaAlerta.EVENTO_PROXIMO } }),
      this.configRepo.findOne({ where: { tipoRegla: TipoReglaAlerta.EVENTO_VENCIDO } }),
    ]);

    const ahora = new Date();
    const eventosActivos = await this.eventoRepo
      .createQueryBuilder('e')
      .where('e.estado NOT IN (:...estados)', {
        estados: [EstadoEventoAgenda.COMPLETADO, EstadoEventoAgenda.CANCELADO],
      })
      .getMany();

    let resultado = { creadas: 0, resueltas: 0, nuevas: [] as Alerta[] };

    if (configVencido?.activa) {
      const vencidos = eventosActivos.filter((e) => e.fechaHoraInicio < ahora);
      const candidatos: CandidatoAlerta[] = vencidos.map((e) => ({
        entidadId: e.id,
        mensaje: `El evento "${e.titulo}" ya pasó su fecha/hora y no se ha marcado como completado.`,
        severidad: configVencido.severidadDefault,
      }));
      const r = await this.sincronizar(TipoReglaAlerta.EVENTO_VENCIDO, 'agendaEventoId', candidatos);
      resultado.creadas += r.creadas;
      resultado.resueltas += r.resueltas;
      resultado.nuevas = resultado.nuevas.concat(r.nuevas);
    }

    if (configProximo?.activa) {
      const limite = new Date(ahora);
      limite.setDate(limite.getDate() + (configProximo.umbralDias ?? 1));

      const proximos = eventosActivos.filter(
        (e) => e.fechaHoraInicio >= ahora && e.fechaHoraInicio <= limite,
      );
      const candidatos: CandidatoAlerta[] = proximos.map((e) => ({
        entidadId: e.id,
        mensaje: `El evento "${e.titulo}" está próximo (${e.fechaHoraInicio.toISOString()}).`,
        severidad: configProximo.severidadDefault,
      }));
      const r = await this.sincronizar(TipoReglaAlerta.EVENTO_PROXIMO, 'agendaEventoId', candidatos);
      resultado.creadas += r.creadas;
      resultado.resueltas += r.resueltas;
      resultado.nuevas = resultado.nuevas.concat(r.nuevas);
    }

    return resultado;
  }

  /**
   * Sincroniza el estado de alertas abiertas de un tipo de regla contra la
   * lista actual de entidades que cumplen la condición: crea las que
   * faltan y resuelve automáticamente las que ya no aplican — sección 14
   * ("si la condición deja de cumplirse, se marca resuelta").
   */
  private async sincronizar(
    tipoRegla: TipoReglaAlerta,
    campo: CampoEntidad,
    candidatos: CandidatoAlerta[],
  ): Promise<{ creadas: number; resueltas: number; nuevas: Alerta[] }> {
    const abiertas = await this.alertaRepo.find({ where: { tipoRegla, resuelta: false } });
    const abiertasPorEntidad = new Map(abiertas.map((a) => [a[campo] ?? '', a]));
    const idsCandidatos = new Set(candidatos.map((c) => c.entidadId));

    let creadas = 0;
    const nuevas: Alerta[] = [];
    for (const candidato of candidatos) {
      if (!abiertasPorEntidad.has(candidato.entidadId)) {
        const nueva = this.alertaRepo.create({
          tipoRegla,
          severidad: candidato.severidad,
          mensaje: candidato.mensaje,
          [campo]: candidato.entidadId,
        });
        const guardada = await this.alertaRepo.save(nueva);
        nuevas.push(guardada);
        creadas++;
      }
    }

    let resueltas = 0;
    for (const abierta of abiertas) {
      const entidadId = abierta[campo];
      if (entidadId && !idsCandidatos.has(entidadId)) {
        await this.alertaRepo.update(abierta.id, { resuelta: true, resueltaEn: new Date() });
        resueltas++;
      }
    }

    return { creadas, resueltas, nuevas };
  }
}
