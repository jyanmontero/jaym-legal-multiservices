import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Factura } from '../facturacion/factura.entity.js';
import { ClientesService } from '../clientes/clientes.service.js';
import { ExpedientesService, UsuarioActual } from '../expedientes/expedientes.service.js';
import { ROLES_CON_ACCESO_FACTURACION, TipoCliente } from '../common/enums/index.js';

const LIMITE_POR_TIPO = 8;

export interface ResultadoBusqueda {
  tipo: 'cliente' | 'expediente' | 'factura';
  id: string;
  titulo: string;
  subtitulo: string;
  ruta: string;
}

function nombreCliente(cliente: { tipo: TipoCliente; nombres?: string; apellidos?: string; razonSocial?: string; nombreComercial?: string }): string {
  return cliente.tipo === TipoCliente.JURIDICO
    ? (cliente.razonSocial ?? cliente.nombreComercial ?? '')
    : `${cliente.nombres ?? ''} ${cliente.apellidos ?? ''}`.trim();
}

@Injectable()
export class BusquedaService {
  constructor(
    private readonly clientesService: ClientesService,
    private readonly expedientesService: ExpedientesService,
    @InjectRepository(Factura)
    private readonly facturaRepo: Repository<Factura>,
  ) {}

  /**
   * Búsqueda combinada para clientes, expedientes y facturas -- sección de
   * "buscador global". Cada módulo mantiene su propia regla de visibilidad
   * (un abogado sin visibilidad total no ve expedientes ajenos; solo los
   * roles con acceso a facturación ven facturas), así que este servicio no
   * duplica esas reglas: llama a los mismos servicios que ya las aplican.
   */
  async buscar(termino: string, usuarioActual: UsuarioActual): Promise<ResultadoBusqueda[]> {
    const t = termino.trim();
    if (t.length < 2) return [];

    const [clientes, expedientes] = await Promise.all([
      this.clientesService.buscar(t),
      this.expedientesService.listar({ q: t }, usuarioActual),
    ]);

    const resultados: ResultadoBusqueda[] = [];

    for (const c of clientes.slice(0, LIMITE_POR_TIPO)) {
      resultados.push({
        tipo: 'cliente',
        id: c.id,
        titulo: nombreCliente(c) || c.codigoCliente,
        subtitulo: `${c.codigoCliente} · ${c.cedula || c.rnc || c.pasaporte || c.correo || ''}`.replace(/ · $/, ''),
        ruta: `/clientes/${c.id}`,
      });
    }

    for (const e of expedientes.slice(0, LIMITE_POR_TIPO)) {
      resultados.push({
        tipo: 'expediente',
        id: e.id,
        titulo: e.codigo,
        subtitulo: [e.materia.replace(/_/g, ' '), e.contraparte ? `vs. ${e.contraparte}` : null]
          .filter(Boolean)
          .join(' · '),
        ruta: `/expedientes/${e.id}`,
      });
    }

    if (ROLES_CON_ACCESO_FACTURACION.includes(usuarioActual.rol)) {
      const facturas = await this.facturaRepo
        .createQueryBuilder('f')
        .where('f.numero ILIKE :t OR f.concepto ILIKE :t OR f.ncf ILIKE :t', { t: `%${t}%` })
        .orderBy('f.fechaEmision', 'DESC')
        .take(LIMITE_POR_TIPO)
        .getMany();

      for (const f of facturas) {
        resultados.push({
          tipo: 'factura',
          id: f.id,
          titulo: f.numero,
          subtitulo: `${f.concepto} · RD$ ${Number(f.total).toLocaleString('es-DO')}`,
          ruta: `/facturas`,
        });
      }
    }

    return resultados;
  }
}
