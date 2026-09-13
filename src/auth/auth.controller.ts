import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { UsuariosService } from '../usuarios/usuarios.service.js';
import {
  LoginDto,
  VerificarDosFactorDto,
  CambiarPasswordDto,
  OlvidePasswordDto,
  RestablecerPasswordDto,
} from './dto/auth.dto.js';
import { CreateUsuarioDto } from '../usuarios/dto/create-usuario.dto.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usuariosService: UsuariosService,
  ) {}

  // Máximo 5 intentos por minuto por IP — evita fuerza bruta sobre contraseñas.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * Bootstrap de un solo uso: crea el primer Superadministrador. Solo
   * funciona si todavía no existe ningún usuario en el sistema — evita el
   * problema de "necesito un superadmin para crear al primer superadmin".
   * Una vez exista al menos un usuario, este endpoint queda inutilizado y
   * la creación de usuarios pasa por POST /usuarios (protegido por rol).
   */
  @Public()
  @Post('registro-inicial')
  async registroInicial(@Body() dto: CreateUsuarioDto) {
    // La verificación de "¿existe algún usuario?" y la creación ocurren
    // atómicamente dentro del servicio (advisory lock + misma transacción)
    // -- ver UsuariosService.crearPrimerSuperadministrador() para el porqué.
    return this.usuariosService.crearPrimerSuperadministrador(dto);
  }

  @Post('2fa/iniciar')
  iniciarDosFactor(@CurrentUser('sub') usuarioId: string) {
    return this.authService.iniciarActivacionDosFactor(usuarioId);
  }

  @Post('2fa/confirmar')
  confirmarDosFactor(
    @CurrentUser('sub') usuarioId: string,
    @Body() dto: VerificarDosFactorDto,
  ) {
    return this.authService.confirmarActivacionDosFactor(usuarioId, dto.codigo);
  }

  /**
   * Cambio de contraseña por el propio usuario logueado (self-service).
   * Requiere la contraseña actual — ver AuthService.cambiarPassword.
   */
  @Post('cambiar-password')
  cambiarPassword(
    @CurrentUser('sub') usuarioId: string,
    @Body() dto: CambiarPasswordDto,
  ) {
    return this.authService.cambiarPassword(usuarioId, dto.actual, dto.nueva);
  }

  // Límite bajo a propósito: cada solicitud manda un correo real -- sin
  // esto, alguien podría usar este endpoint para bombardear la bandeja de
  // entrada de otra persona.
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  @Public()
  @Post('olvide-password')
  olvidePassword(@Body() dto: OlvidePasswordDto) {
    return this.authService.solicitarRestablecerPassword(dto.correo);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Public()
  @Post('restablecer-password')
  restablecerPassword(@Body() dto: RestablecerPasswordDto) {
    return this.authService.restablecerPassword(dto.token, dto.nuevaPassword);
  }
}
