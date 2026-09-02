import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cliente } from './cliente.entity.js';
import { CreateClienteDto, UpdateClienteDto } from './dto/create-cliente.dto.js';
import { EstadoCliente, TipoCliente } from '../common/enums/index.js';

export interface PosibleDuplicado {
  campo: 'cedula' | 'pasaporte' | 'rnc' | 'correo';
  clienteExistente: Cliente;
}

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
  ) {}

  /**
   * Detecta clientes existentes que compartan cédula, pasaporte, RNC o
   * correo con los datos entrantes — sección 4 del requerimiento.
   * Se ejecuta ANTES de intentar el insert, para poder advertir al usuario
   * en la interfaz en vez de solo fallar por una violación de índice único.
   */
  async detectarDuplicados(
    dto: Pick<CreateClienteDto, 'cedula' | 'pasaporte' | 'rnc' | 'correo'>,
  ): Promise<PosibleDuplicado[]> {
    const duplicados: PosibleDuplicado[] = [];

    const campos: Array<'cedula' | 'pasaporte' | 'rnc' | 'correo'> = [
      'cedula',
      'pasaporte',
      'rnc',
      'correo',
    ];

    for (const campo of campos) {
      const valor = dto[campo];
      if (!valor) continue;
      const existente = await this.clienteRepo.findOne({
        where: { [campo]: valor } as any,
      });
      if (existente) {
        duplicados.push({ campo, clienteExistente: existente });
      }
    }

    return duplicados;
  }

  /**
   * Genera el siguiente código de cliente (CL-0001, CL-0002, ...).
   * Nota: para volumen bajo (decenas/cientos de clientes al año) esto es
   * suficiente; con concurrencia alta se recomendaría una secuencia nativa
   * de PostgreSQL en vez de contar filas.
   */
  private async generarCodigoCliente(): Promise<string> {
    const total = await this.clienteRepo.count();
    const siguiente = total + 1;
    return `CL-${String(siguiente).padStart(4, '0')}`;
  }

  async crear(
    dto: CreateClienteDto,
    opts: { forzarPeseADuplicado?: boolean; usuarioId?: string } = {},
  ): Promise<{ cliente?: Cliente; duplicados?: PosibleDuplicado[] }> {
    const duplicados = await this.detectarDuplicados(dto);

    if (duplicados.length > 0 && !opts.forzarPeseADuplicado) {
      // No se bloquea de forma absoluta: se devuelve la advertencia para que
      // el usuario decida en la interfaz, tal como pide la sección 4.
      return { duplicados };
    }

    const codigoCliente = await this.generarCodigoCliente();

    const cliente = this.clienteRepo.create({
      ...dto,
      codigoCliente,
      telefonos: dto.telefonos ?? [],
      estado: EstadoCliente.PROSPECTO,
      creadoPorId: opts.usuarioId,
    });

    try {
      const guardado = await this.clienteRepo.save(cliente);
      return { cliente: guardado };
    } catch (err: any) {
      if (err.code === '23505') {
        // Violación de índice único a nivel de BD — última línea de defensa
        // contra condiciones de carrera entre la detección y el insert.
        throw new ConflictException(
          'Ya existe un cliente con la misma cédula, pasaporte, RNC o correo.',
        );
      }
      throw err;
    }
  }

  async buscar(termino?: string, tipo?: TipoCliente): Promise<Cliente[]> {
    const qb = this.clienteRepo.createQueryBuilder('cliente');

    if (tipo) {
      qb.andWhere('cliente.tipo = :tipo', { tipo });
    }

    if (termino) {
      qb.andWhere(
        `(cliente.nombres ILIKE :t OR cliente.apellidos ILIKE :t
          OR cliente.razonSocial ILIKE :t OR cliente.nombreComercial ILIKE :t
          OR cliente.cedula ILIKE :t OR cliente.pasaporte ILIKE :t
          OR cliente.rnc ILIKE :t OR cliente.correo ILIKE :t)`,
        { t: `%${termino}%` },
      );
    }

    return qb.orderBy('cliente.creadoEn', 'DESC').getMany();
  }

  async obtenerPorId(id: string): Promise<Cliente> {
    const cliente = await this.clienteRepo.findOne({ where: { id } });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    return cliente;
  }

  async actualizar(id: string, dto: UpdateClienteDto): Promise<Cliente> {
    const cliente = await this.obtenerPorId(id);

    // Misma protección contra duplicados que en la creación, pero excluyendo
    // el propio registro que se está editando.
    const campos: Array<'cedula' | 'pasaporte' | 'rnc' | 'correo'> = [
      'cedula', 'pasaporte', 'rnc', 'correo',
    ];
    for (const campo of campos) {
      const valor = (dto as any)[campo];
      if (!valor) continue;
      const existente = await this.clienteRepo.findOne({ where: { [campo]: valor } as any });
      if (existente && existente.id !== id) {
        throw new ConflictException(
          `Ya existe otro cliente con ese ${campo === 'correo' ? 'correo' : campo}.`,
        );
      }
    }

    this.clienteRepo.merge(cliente, dto);
    return this.clienteRepo.save(cliente);
  }
}
