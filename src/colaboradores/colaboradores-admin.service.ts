import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Colaborador } from './colaborador.entity.js';
import { ColaboradorExpediente } from './colaborador-expediente.entity.js';
import { Expediente } from '../expedientes/expediente.entity.js';
import { CrearColaboradorDto, ActualizarColaboradorDto } from './dto/crear-colaborador.dto.js';
import { AsignarExpedienteColaboradorDto } from './dto/asignar-expediente.dto.js';
import { CorreoService } from '../notificaciones/correo.service.js';
import { ConfigService } from '@nestjs/config';

function generarPasswordTemporal(): string {
  // 10 caracteres legibles (sin 0/O/1/l para evitar confusión al transcribir)
  // -- mismo generador que PortalUsuariosAdminService.
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => alfabeto[crypto.randomInt(alfabeto.length)]).join('');
}

/**
 * Administración (lado staff) del Portal de Colaboradores -- crear/listar/
 * activar-desactivar cuentas, y asignar/desasignar los expedientes que cada
 * colaborador puede consultar. No confundir con ColaboradorAuthService, que
 * es el login del propio colaborador.
 */
@Injectable()
export class ColaboradoresAdminService {
  constructor(
    @InjectRepository(Colaborador) private readonly colaboradorRepo: Repository<Colaborador>,
    @InjectRepository(ColaboradorExpediente) private readonly asignacionRepo: Repository<ColaboradorExpediente>,
    @InjectRepository(Expediente) private readonly expedienteRepo: Repository<Expediente>,
    private readonly correoService: CorreoService,
    private readonly config: ConfigService,
  ) {}

  async listar(): Promise<Omit<Colaborador, 'passwordHash'>[]> {
    const cuentas = await this.colaboradorRepo.find({ order: { creadoEn: 'DESC' } });
    return cuentas.map(({ passwordHash, ...resto }) => resto);
  }

  async crear(dto: CrearColaboradorDto, creadoPorId: string) {
    const existente = await this.colaboradorRepo.findOne({ where: { correo: dto.correo } });
    if (existente) {
      throw new BadRequestException('Ya existe un colaborador con ese correo.');
    }

    const passwordTemporal = generarPasswordTemporal();
    const passwordHash = await bcrypt.hash(passwordTemporal, 12);
    const cuenta = await this.colaboradorRepo.save(
      this.colaboradorRepo.create({
        nombreCompleto: dto.nombreCompleto,
        correo: dto.correo,
        tipo: dto.tipo,
        telefono: dto.telefono,
        notas: dto.notas,
        passwordHash,
        debeCambiarPassword: true,
        creadoPorId,
      }),
    );

    await this.enviarInvitacion(cuenta, passwordTemporal);

    const { passwordHash: _omitido, ...publico } = cuenta;
    return publico;
  }

  async actualizar(id: string, dto: ActualizarColaboradorDto) {
    await this.obtenerPorId(id);
    await this.colaboradorRepo.update(id, dto);
    return { actualizado: true };
  }

  async reenviarInvitacion(id: string): Promise<{ enviado: boolean }> {
    const cuenta = await this.obtenerPorId(id);
    const passwordTemporal = generarPasswordTemporal();
    const passwordHash = await bcrypt.hash(passwordTemporal, 12);
    // tokenVersion + 1 invalida de inmediato cualquier sesión que quedara
    // abierta con la contraseña anterior -- ver ColaboradorAuthGuard.
    await this.colaboradorRepo.update(id, {
      passwordHash,
      debeCambiarPassword: true,
      activo: true,
      tokenVersion: cuenta.tokenVersion + 1,
    });
    const enviado = await this.enviarInvitacion(cuenta, passwordTemporal);
    return { enviado };
  }

  async cambiarActivo(id: string, activo: boolean) {
    const cuenta = await this.obtenerPorId(id);
    // tokenVersion + 1 asegura que desactivar (o reactivar) una cuenta corta
    // de inmediato cualquier sesión con un JWT ya emitido, en vez de esperar
    // hasta 14 días a que venza por su cuenta.
    await this.colaboradorRepo.update(id, { activo, tokenVersion: cuenta.tokenVersion + 1 });
    return { actualizado: true };
  }

  private async obtenerPorId(id: string): Promise<Colaborador> {
    const cuenta = await this.colaboradorRepo.findOne({ where: { id } });
    if (!cuenta) throw new NotFoundException('Colaborador no encontrado');
    return cuenta;
  }

  // --- Asignación de expedientes -------------------------------------------

  async listarAsignaciones(colaboradorId: string): Promise<ColaboradorExpediente[]> {
    await this.obtenerPorId(colaboradorId);
    return this.asignacionRepo.find({ where: { colaboradorId }, order: { asignadoEn: 'DESC' } });
  }

  async asignarExpediente(colaboradorId: string, dto: AsignarExpedienteColaboradorDto, asignadoPorId: string) {
    await this.obtenerPorId(colaboradorId);
    const expediente = await this.expedienteRepo.findOne({ where: { id: dto.expedienteId } });
    if (!expediente) throw new NotFoundException('Expediente no encontrado');

    const yaAsignado = await this.asignacionRepo.findOne({
      where: { colaboradorId, expedienteId: dto.expedienteId },
    });
    if (yaAsignado) {
      throw new ConflictException('Este expediente ya está asignado a ese colaborador.');
    }

    return this.asignacionRepo.save(
      this.asignacionRepo.create({
        colaboradorId,
        expedienteId: dto.expedienteId,
        notas: dto.notas,
        asignadoPorId,
      }),
    );
  }

  async desasignarExpediente(colaboradorId: string, expedienteId: string) {
    const asignacion = await this.asignacionRepo.findOne({ where: { colaboradorId, expedienteId } });
    if (!asignacion) throw new NotFoundException('Ese expediente no está asignado a este colaborador.');
    await this.asignacionRepo.delete(asignacion.id);
    return { desasignado: true };
  }

  private async enviarInvitacion(cuenta: Colaborador, passwordTemporal: string): Promise<boolean> {
    const frontendUrl = (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173').split(',')[0].trim();
    return this.correoService.enviar({
      to: cuenta.correo,
      subject: 'Acceso al Portal de Colaboradores — JAYM LEGAL',
      html: `
        <p>Hola ${cuenta.nombreCompleto},</p>
        <p>Se te habilitó acceso al Portal de Colaboradores de JAYM LEGAL, donde podrás consultar los expedientes y tareas que se te asignen.</p>
        <p><strong>Enlace:</strong> <a href="${frontendUrl}/colaboradores/login">${frontendUrl}/colaboradores/login</a><br>
        <strong>Correo:</strong> ${cuenta.correo}<br>
        <strong>Contraseña temporal:</strong> ${passwordTemporal}</p>
        <p>Por seguridad, el sistema te pedirá cambiarla la primera vez que entres.</p>
      `,
    });
  }
}
