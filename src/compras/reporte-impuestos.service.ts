import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Not, Repository } from 'typeorm';
import ExcelJS from 'exceljs';
import { Compra, EstadoCompra } from './compra.entity.js';
import { Factura } from '../facturacion/factura.entity.js';
import { Pago } from '../facturacion/pago.entity.js';
import { Cliente } from '../clientes/cliente.entity.js';
import { EstadoFactura, MetodoPago, TASA_ITBIS, TipoCliente } from '../common/enums/index.js';
import { MARCA_CORPORATIVA } from '../common/constants/marca-corporativa.js';
import {
  COLUMNAS_606,
  COLUMNAS_607,
  FORMAS_PAGO_606,
  TIPOS_BIENES_SERVICIOS,
  construirTxt,
  fila606,
  fila607,
  nombreArchivoDgii,
  normalizarNcf,
  periodoAAAAMM,
  rangoDelMes,
  redondear2,
  tipoIdentificacionDe,
  type CompraParaReporte,
  type VentaParaReporte,
} from './fiscal.util.js';

export interface ResumenImpuestos {
  periodo: string;
  anio: number;
  mes: number;
  ventas: {
    cantidadFacturas: number;
    baseGravada: number;
    baseExenta: number;
    totalSinImpuestos: number;
    itbisFacturado: number;
    facturasSinNcf: number;
  };
  compras: {
    cantidadFacturas: number;
    totalSinImpuestos: number;
    itbisFacturado: number;
    itbisAlCosto: number;
    itbisAdelantable: number;
    itbisRetenido: number;
    retencionRenta: number;
  };
  /** ITBIS de ventas menos ITBIS adelantable de compras. Negativo = a favor en el mes. */
  itbisNetoDelMes: number;
  pendientes: string[];
  notas: string[];
}

interface DatosPeriodo {
  resumen: ResumenImpuestos;
  compras: CompraParaReporte[];
  ventas606: Compra[];
  ventas: VentaParaReporte[];
  ventasSinNcf: { numero: string; cliente: string; fecha: string; total: string }[];
}

function nombreDeCliente(c?: Cliente): string {
  if (!c) return '—';
  return c.tipo === TipoCliente.JURIDICO ? (c.razonSocial ?? '—') : `${c.nombres ?? ''} ${c.apellidos ?? ''}`.trim() || '—';
}

@Injectable()
export class ReporteImpuestosService {
  constructor(
    @InjectRepository(Compra) private readonly compraRepo: Repository<Compra>,
    @InjectRepository(Factura) private readonly facturaRepo: Repository<Factura>,
    @InjectRepository(Pago) private readonly pagoRepo: Repository<Pago>,
    @InjectRepository(Cliente) private readonly clienteRepo: Repository<Cliente>,
  ) {}

  /** Reúne todo lo que entra al período; es la única consulta que usan el resumen, el Excel y los TXT. */
  async datosDelPeriodo(anio: number, mes: number): Promise<DatosPeriodo> {
    const { desde, hasta } = rangoDelMes(anio, mes);

    const comprasDb = await this.compraRepo.find({
      where: { fechaComprobante: Between(desde, hasta), estado: EstadoCompra.CONFIRMADA },
      order: { fechaComprobante: 'ASC', creadoEn: 'ASC' },
    });

    const facturas = await this.facturaRepo.find({
      where: { fechaEmision: Between(desde, hasta), estado: Not(EstadoFactura.ANULADA) },
      order: { fechaEmision: 'ASC', numero: 'ASC' },
    });
    const clientes = facturas.length
      ? await this.clienteRepo.findBy({ id: In([...new Set(facturas.map((f) => f.clienteId))]) })
      : [];
    const clientePorId = new Map(clientes.map((c) => [c.id, c]));
    const pagos = facturas.length
      ? (await this.pagoRepo.findBy({ facturaId: In(facturas.map((f) => f.id)) })).filter((p) => p.fecha <= hasta)
      : [];

    const pendientes: string[] = [];
    const ventas: VentaParaReporte[] = [];
    const ventasSinNcf: DatosPeriodo['ventasSinNcf'] = [];
    let baseGravada = 0;
    let baseExenta = 0;
    let itbisVentas = 0;

    for (const f of facturas) {
      const sinImpuestos = Number(f.subtotal) - Number(f.descuento);
      const itbis = Number(f.itbis);
      const gravada = redondear2(itbis / TASA_ITBIS);
      baseGravada += Math.min(gravada, sinImpuestos);
      baseExenta += Math.max(sinImpuestos - gravada, 0);
      itbisVentas += itbis;

      const cliente = clientePorId.get(f.clienteId);
      const ncf = normalizarNcf(f.ncf);
      if (!ncf) {
        ventasSinNcf.push({ numero: f.numero, cliente: nombreDeCliente(cliente), fecha: f.fechaEmision, total: f.total });
        continue;
      }

      let identificacion = '';
      let tipoId = 1;
      if (cliente?.rnc) {
        identificacion = cliente.rnc;
        tipoId = 1;
      } else if (cliente?.cedula) {
        identificacion = cliente.cedula;
        tipoId = 2;
      } else if (cliente?.pasaporte) {
        identificacion = cliente.pasaporte;
        tipoId = 3;
      }
      if (!identificacion) {
        pendientes.push(`Factura ${f.numero}: el cliente ${nombreDeCliente(cliente)} no tiene RNC, cédula ni pasaporte registrado; hace falta para el 607.`);
      } else if (tipoId !== 3) {
        const tipoReal = tipoIdentificacionDe(identificacion);
        if (!tipoReal) pendientes.push(`Factura ${f.numero}: la identificación del cliente (${identificacion}) no tiene 9 dígitos (RNC) ni 11 (cédula).`);
        else tipoId = tipoReal;
      }

      const pagosFactura = pagos.filter((p) => p.facturaId === f.id);
      const suma = (metodos: MetodoPago[]) =>
        redondear2(pagosFactura.filter((p) => metodos.includes(p.metodo)).reduce((a, p) => a + Number(p.monto), 0));
      const efectivo = suma([MetodoPago.EFECTIVO]);
      const chequeTransferencia = suma([MetodoPago.TRANSFERENCIA, MetodoPago.CHEQUE]);
      const tarjeta = suma([MetodoPago.TARJETA]);
      const otras = suma([MetodoPago.OTRO]);
      const pagado = efectivo + chequeTransferencia + tarjeta + otras;
      const credito = Math.max(redondear2(Number(f.total) - pagado), 0);

      ventas.push({
        facturaNumero: f.numero,
        identificacion,
        tipoIdentificacion: tipoId,
        ncf,
        fechaComprobante: f.fechaEmision,
        montoFacturado: redondear2(sinImpuestos),
        itbisFacturado: redondear2(itbis),
        efectivo,
        chequeTransferencia,
        tarjeta,
        credito,
        otras,
      });
    }

    if (ventasSinNcf.length) {
      pendientes.push(
        `${ventasSinNcf.length} factura(s) emitida(s) en el mes no tienen NCF/e-NCF registrado (${ventasSinNcf.map((v) => v.numero).join(', ')}). Entran al resumen de ITBIS pero no pueden ir en el 607 hasta tener comprobante fiscal.`,
      );
    }

    const compras: CompraParaReporte[] = comprasDb.map((c) => ({ ...c }));
    const sumaCompras = (campo: keyof Compra) => comprasDb.reduce((a, c) => a + Number(c[campo] ?? 0), 0);
    const itbisCompras = sumaCompras('itbisFacturado');
    const alCosto = sumaCompras('itbisAlCosto');
    const adelantable = redondear2(itbisCompras - alCosto);

    const resumen: ResumenImpuestos = {
      periodo: periodoAAAAMM(anio, mes),
      anio,
      mes,
      ventas: {
        cantidadFacturas: facturas.length,
        baseGravada: redondear2(baseGravada),
        baseExenta: redondear2(baseExenta),
        totalSinImpuestos: redondear2(baseGravada + baseExenta),
        itbisFacturado: redondear2(itbisVentas),
        facturasSinNcf: ventasSinNcf.length,
      },
      compras: {
        cantidadFacturas: comprasDb.length,
        totalSinImpuestos: redondear2(sumaCompras('montoServicios') + sumaCompras('montoBienes')),
        itbisFacturado: redondear2(itbisCompras),
        itbisAlCosto: redondear2(alCosto),
        itbisAdelantable: adelantable,
        itbisRetenido: redondear2(sumaCompras('itbisRetenido')),
        retencionRenta: redondear2(sumaCompras('retencionRenta')),
      },
      itbisNetoDelMes: redondear2(itbisVentas - adelantable),
      pendientes,
      notas: [
        'Resumen de apoyo para el contador: no sustituye la declaración IT-1. No incluye saldo a favor de meses anteriores, anticipos, retenciones recibidas ni otros ajustes.',
        'Las ventas se toman de las facturas emitidas en el mes (no anuladas), sin importar si ya se cobraron. Las compras, de las facturas de gasto confirmadas con fecha de comprobante en el mes.',
        'El contador debe validar los tipos de gasto, el ITBIS adelantable y las retenciones antes de presentar. Si la firma ya es emisora de comprobantes electrónicos, preguntarle si la DGII ya pre-llena el 606/607 con esos comprobantes.',
      ],
    };

    return { resumen, compras, ventas606: comprasDb, ventas, ventasSinNcf };
  }

  async resumen(anio: number, mes: number): Promise<ResumenImpuestos> {
    return (await this.datosDelPeriodo(anio, mes)).resumen;
  }

  async txt606(anio: number, mes: number): Promise<{ nombre: string; contenido: string }> {
    const { compras } = await this.datosDelPeriodo(anio, mes);
    const periodo = periodoAAAAMM(anio, mes);
    return {
      nombre: nombreArchivoDgii('606', MARCA_CORPORATIVA.rnc, periodo),
      contenido: construirTxt('606', MARCA_CORPORATIVA.rnc, periodo, compras.map(fila606)),
    };
  }

  async txt607(anio: number, mes: number): Promise<{ nombre: string; contenido: string }> {
    const { ventas } = await this.datosDelPeriodo(anio, mes);
    const periodo = periodoAAAAMM(anio, mes);
    return {
      nombre: nombreArchivoDgii('607', MARCA_CORPORATIVA.rnc, periodo),
      contenido: construirTxt('607', MARCA_CORPORATIVA.rnc, periodo, ventas.map(fila607)),
    };
  }

  /** Excel de apoyo: resumen de ITBIS, detalle 606, detalle 607 y pendientes de revisión. */
  async excel(anio: number, mes: number): Promise<{ nombre: string; buffer: Buffer }> {
    const datos = await this.datosDelPeriodo(anio, mes);
    const r = datos.resumen;
    const libro = new ExcelJS.Workbook();
    libro.creator = MARCA_CORPORATIVA.razonSocial;
    libro.created = new Date();
    const AZUL = 'FF0A1E3F';

    const estiloEncabezado = (fila: ExcelJS.Row) => {
      fila.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      fila.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
      fila.alignment = { vertical: 'middle', wrapText: true };
    };
    const FORMATO_DINERO = '#,##0.00';

    // 1. Resumen
    const h1 = libro.addWorksheet('Resumen ITBIS');
    h1.columns = [{ width: 58 }, { width: 20 }];
    h1.addRow([`${MARCA_CORPORATIVA.razonSocial} — RNC ${MARCA_CORPORATIVA.rnc}`]).font = { bold: true, size: 13, color: { argb: AZUL } };
    h1.addRow([`Resumen de apoyo para la declaración — período ${r.periodo}`]).font = { bold: true };
    h1.addRow([]);
    const linea = (etiqueta: string, valor: number, negrita = false) => {
      const f = h1.addRow([etiqueta, valor]);
      f.getCell(2).numFmt = FORMATO_DINERO;
      if (negrita) f.font = { bold: true };
    };
    h1.addRow(['VENTAS (facturas emitidas en el mes)']).font = { bold: true };
    linea(`Cantidad de facturas`, r.ventas.cantidadFacturas);
    h1.lastRow!.getCell(2).numFmt = '0';
    linea('Ventas gravadas (sin ITBIS)', r.ventas.baseGravada);
    linea('Ventas exentas', r.ventas.baseExenta);
    linea('Total ventas sin impuestos', r.ventas.totalSinImpuestos, true);
    linea('ITBIS facturado en ventas', r.ventas.itbisFacturado, true);
    h1.addRow([]);
    h1.addRow(['COMPRAS Y GASTOS (facturas de gasto confirmadas)']).font = { bold: true };
    linea('Cantidad de facturas de gasto', r.compras.cantidadFacturas);
    h1.lastRow!.getCell(2).numFmt = '0';
    linea('Total compras sin impuestos', r.compras.totalSinImpuestos);
    linea('ITBIS facturado en compras', r.compras.itbisFacturado);
    linea('(-) ITBIS llevado al costo', r.compras.itbisAlCosto);
    linea('ITBIS adelantable', r.compras.itbisAdelantable, true);
    linea('Retenciones de ITBIS practicadas a proveedores', r.compras.itbisRetenido);
    linea('Retenciones de renta practicadas a proveedores', r.compras.retencionRenta);
    h1.addRow([]);
    linea(r.itbisNetoDelMes >= 0 ? 'ITBIS neto del mes (ventas − adelantable): por pagar' : 'ITBIS neto del mes: a favor', Math.abs(r.itbisNetoDelMes), true);
    h1.addRow([]);
    if (r.pendientes.length) {
      h1.addRow(['PENDIENTES DE REVISIÓN']).font = { bold: true, color: { argb: 'FFB00020' } };
      for (const p of r.pendientes) {
        h1.mergeCells(h1.rowCount + 1, 1, h1.rowCount + 1, 2);
        const f = h1.addRow([p]);
        f.alignment = { wrapText: true, vertical: 'top' };
        f.height = 45;
      }
      h1.addRow([]);
    }
    h1.addRow(['NOTAS']).font = { bold: true };
    for (const n of r.notas) {
      h1.mergeCells(h1.rowCount + 1, 1, h1.rowCount + 1, 2);
      const f = h1.addRow([n]);
      f.alignment = { wrapText: true, vertical: 'top' };
      f.height = 48;
    }

    // 2. 606 con las columnas oficiales
    const h2 = libro.addWorksheet('606 Compras');
    h2.addRow([...COLUMNAS_606]);
    estiloEncabezado(h2.getRow(1));
    h2.getRow(1).height = 45;
    h2.columns = COLUMNAS_606.map(() => ({ width: 18 }));
    for (const c of datos.compras) h2.addRow(fila606(c));
    h2.views = [{ state: 'frozen', ySplit: 1 }];

    // 3. 607
    const h3 = libro.addWorksheet('607 Ventas');
    h3.addRow([...COLUMNAS_607]);
    estiloEncabezado(h3.getRow(1));
    h3.getRow(1).height = 45;
    h3.columns = COLUMNAS_607.map(() => ({ width: 18 }));
    for (const v of datos.ventas) h3.addRow(fila607(v));
    h3.views = [{ state: 'frozen', ySplit: 1 }];

    // 4. Detalle legible de gastos, para revisar contra las facturas
    const h4 = libro.addWorksheet('Detalle de gastos');
    const enc4 = ['Fecha', 'Proveedor', 'RNC/Cédula', 'NCF', 'Tipo de gasto', 'Forma de pago', 'Base sin ITBIS', 'ITBIS', 'Total', 'Concepto', 'Origen'];
    h4.addRow(enc4);
    estiloEncabezado(h4.getRow(1));
    h4.columns = [14, 34, 16, 18, 36, 24, 16, 14, 16, 40, 12].map((width) => ({ width }));
    for (const c of datos.ventas606) {
      const f = h4.addRow([
        c.fechaComprobante,
        c.proveedorNombre,
        c.proveedorIdentificacion,
        c.ncf,
        TIPOS_BIENES_SERVICIOS[c.tipoBienesServicios] ?? c.tipoBienesServicios,
        FORMAS_PAGO_606[c.formaPago] ?? c.formaPago,
        Number(c.montoServicios) + Number(c.montoBienes),
        Number(c.itbisFacturado),
        Number(c.total),
        c.concepto ?? '',
        c.origen === 'lectura_ia' ? 'Lectura asistida' : 'Manual',
      ]);
      [7, 8, 9].forEach((i) => (f.getCell(i).numFmt = FORMATO_DINERO));
    }
    h4.views = [{ state: 'frozen', ySplit: 1 }];

    // 5. Facturas emitidas sin NCF (no pueden ir al 607)
    if (datos.ventasSinNcf.length) {
      const h5 = libro.addWorksheet('Ventas sin NCF');
      h5.addRow(['Factura', 'Cliente', 'Fecha', 'Total']);
      estiloEncabezado(h5.getRow(1));
      h5.columns = [16, 40, 14, 16].map((width) => ({ width }));
      for (const v of datos.ventasSinNcf) {
        const f = h5.addRow([v.numero, v.cliente, v.fecha, Number(v.total)]);
        f.getCell(4).numFmt = FORMATO_DINERO;
      }
    }

    const buffer = Buffer.from(await libro.xlsx.writeBuffer());
    return { nombre: `JAYM_Impuestos_${r.periodo}.xlsx`, buffer };
  }
}
