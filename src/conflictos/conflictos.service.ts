import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cliente } from '../clientes/cliente.entity.js';
import { Expediente } from '../expedientes/expediente.entity.js';
import { TipoCliente } from '../common/enums/index.js';

// Un mismo hallazgo puede significar dos cosas distintas según de dónde
// venga la búsqueda -- por eso el "tipo" describe la situación, no solo el
// origen del dato encontrado:
//   - 'ES_CONTRAPARTE_EXISTENTE': el nombre que se está registrando (como
//     cliente nuevo) ya aparece como contraparte en un expediente anterior
//     -- ya representamos a alguien EN CONTRA de esta persona/empresa.
//   - 'COINCIDE_CON_CLIENTE': el nombre que se está registrando (como
//     contraparte de un expediente nuevo) coincide con un cliente actual o
//     anterior del despacho -- posible conflicto de representar a alguien
//     en contra de quien ya es (o fue) cliente.
export type TipoConflicto = 'ES_CONTRAPARTE_EXISTENTE' | 'COINCIDE_CON_CLIENTE';

export interface ConflictoEncontrado {
  tipo: TipoConflicto;
  expedienteId?: string;
  codigoExpediente?: string;
  contraparte?: string;
  clienteId?: string;
  nombreCliente?: string;
  codigoCliente?: string;
}

function nombreCliente(cliente: Cliente): string {
  return cliente.tipo === TipoCliente.JURIDICO
    ? (cliente.razonSocial ?? cliente.nombreComercial ?? '')
    : `${cliente.nombres ?? ''} ${cliente.apellidos ?? ''}`.trim();
}

@Injectable()
export class ConflictosService {
  constructor(
    @InjectRepository(Cliente) private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(Expediente) private readonly expedienteRepo: Repository<Expediente>,
  ) {}

  /**
   * Verificación de conflicto de intereses (sección "impacto medio" de la
   * comparativa de mercado, 14 sept 2026): busca el nombre dado tanto entre
   * las contrapartes ya registradas en expedientes como entre los clientes
   * ya registrados, en ambas direcciones. Es una búsqueda por coincidencia
   * parcial (ILIKE), no exige nombre exacto -- pensada para avisar, no para
   * bloquear: la decisión final de aceptar o no el caso siempre es del
   * abogado.
   */
  async verificarPorNombre(
    nombre: string | undefined,
    opciones: { excluirClienteId?: string; excluirExpedienteId?: string } = {},
  ): Promise<ConflictoEncontrado[]> {
    const termino = (nombre ?? '').trim();
    // Menos de 3 caracteres da demasiados falsos positivos (ej. iniciales,
    // "El", "La") para que valga la pena consultar la base de datos.
    if (termino.length < 3) return [];

    const resultados: ConflictoEncontrado[] = [];

    const expedientesQb = this.expedienteRepo
      .createQueryBuilder('e')
      .where('e.contraparte ILIKE :q', { q: `%${termino}%` });
    if (opciones.excluirExpedienteId) {
      expedientesQb.andWhere('e.id != :id', { id: opciones.excluirExpedienteId });
    }
    const expedientesComoContraparte = await expedientesQb.getMany();
    for (const exp of expedientesComoContraparte) {
      resultados.push({
        tipo: 'ES_CONTRAPARTE_EXISTENTE',
        expedienteId: exp.id,
        codigoExpediente: exp.codigo,
        contraparte: exp.contraparte,
      });
    }

    const clientesQb = this.clienteRepo
      .createQueryBuilder('c')
      .where(
        "(TRIM(COALESCE(c.nombres, '') || ' ' || COALESCE(c.apellidos, '')) ILIKE :q OR c.razonSocial ILIKE :q OR c.nombreComercial ILIKE :q)",
        { q: `%${termino}%` },
      );
    if (opciones.excluirClienteId) {
      clientesQb.andWhere('c.id != :id', { id: opciones.excluirClienteId });
    }
    const clientesCoincidentes = await clientesQb.getMany();
    for (const cli of clientesCoincidentes) {
      resultados.push({
        tipo: 'COINCIDE_CON_CLIENTE',
        clienteId: cli.id,
        nombreCliente: nombreCliente(cli),
        codigoCliente: cli.codigoCliente,
      });
    }

    return resultados;
  }
}
