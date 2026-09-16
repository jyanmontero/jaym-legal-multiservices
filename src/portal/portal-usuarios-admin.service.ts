import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PortalUsuario } from './portal-usuario.entity.js';
import { CrearPortalUsuarioDto } from './dto/crear-portal-usuario.dto.js';
import { CorreoService } from '../notificaciones/correo.service.js';
import { ConfigService } from '@nestjs/config';

function generarPasswordTemporal(): string {
  // 10 caracteres legibles (sin 0/O/1/l para evitar confusión al transcribir).
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => alfabeto[crypto.randomInt(alfabeto.length)]).join('');
}

/**
 * Administración de cuentas del Portal del Cliente -- crear/listar/
 * desactivar el acceso de un cliente, desde el lado interno (staff). No
 * confundir con PortalAuthService, que es el login del propio cliente.
 */
@Injectable()
export class PortalUsuariosAdminService {
  constructor(
    @InjectRepository(PortalUsuario) private readonly portalUsuarioRepo: Repository<PortalUsuario>,
    private readonly correoService: CorreoService,
    private readonly config: ConfigService,
  ) {}

  async listarPorCliente(clienteId: string): Promise<Omit<PortalUsuario, 'passwordHash'>[]> {
    const cuentas = await this.portalUsuarioRepo.find({ where: { clienteId }, order: { creadoEn: 'DESC' } });
    return cuentas.map(({ passwordHash, ...resto }) => resto);
  }

  async crear(clienteId: string, dto: CrearPortalUsuarioDto, creadoPorId: string) {
    const existente = await this.portalUsuarioRepo.findOne({ where: { correo: dto.correo } });
    if (existente) {
      throw new BadRequestException('Ya existe una cuenta del portal con ese correo.');
    }

    const passwordTemporal = generarPasswordTemporal();
    const passwordHash = await bcrypt.hash(passwordTemporal, 12);
    const cuenta = await this.portalUsuarioRepo.save(
      this.portalUsuarioRepo.create({
        clienteId,
        nombreCompleto: dto.nombreCompleto,
        correo: dto.correo,
        passwordHash,
        debeCambiarPassword: true,
        creadoPorId,
      }),
    );

    await this.enviarInvitacion(cuenta, passwordTemporal);

    const { passwordHash: _omitido, ...publico } = cuenta;
    return publico;
  }

  async reenviarInvitacion(id: string): Promise<{ enviado: boolean }> {
    const cuenta = await this.obtenerPorId(id);
    const passwordTemporal = generarPasswordTemporal();
    const passwordHash = await bcrypt.hash(passwordTemporal, 12);
    await this.portalUsuarioRepo.update(id, { passwordHash, debeCambiarPassword: true, activo: true });
    const enviado = await this.enviarInvitacion(cuenta, passwordTemporal);
    return { enviado };
  }

  async cambiarActivo(id: string, activo: boolean) {
    await this.obtenerPorId(id);
    await this.portalUsuarioRepo.update(id, { activo });
    return { actualizado: true };
  }

  private async obtenerPorId(id: string): Promise<PortalUsuario> {
    const cuenta = await this.portalUsuarioRepo.findOne({ where: { id } });
    if (!cuenta) throw new NotFoundException('Cuenta del portal no encontrada');
    return cuenta;
  }

  private async enviarInvitacion(cuenta: PortalUsuario, passwordTemporal: string): Promise<boolean> {
    const frontendUrl = (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173').split(',')[0].trim();
    return this.correoService.enviar({
      to: cuenta.correo,
      subject: 'Acceso al Portal del Cliente — JAYM LEGAL',
      html: `
        <p>Hola ${cuenta.nombreCompleto},</p>
        <p>Ya puedes consultar tu(s) expediente(s), documentos y facturas desde el Portal del Cliente de JAYM LEGAL.</p>
        <p><strong>Enlace:</strong> <a href="${frontendUrl}/portal/login">${frontendUrl}/portal/login</a><br>
        <strong>Correo:</strong> ${cuenta.correo}<br>
        <strong>Contraseña temporal:</strong> ${passwordTemporal}</p>
        <p>Por seguridad, el sistema te pedirá cambiarla la primera vez que entres.</p>
      `,
    });
  }
}
