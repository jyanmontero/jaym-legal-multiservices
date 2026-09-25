import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ColaboradorAuthService } from './colaborador-auth.service.js';
import {
  LoginColaboradorDto,
  SolicitarResetColaboradorDto,
  RestablecerPasswordColaboradorDto,
  CambiarPasswordColaboradorDto,
} from './dto/colaborador-auth.dto.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { ColaboradorAuthGuard } from './colaborador-auth.guard.js';
import { CurrentColaborador } from './current-colaborador.decorator.js';
import { PermitirPasswordPendiente } from './permitir-password-pendiente.decorator.js';

@Controller('colaboradores/auth')
export class ColaboradorAuthController {
  constructor(private readonly colaboradorAuthService: ColaboradorAuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  login(@Body() dto: LoginColaboradorDto) {
    return this.colaboradorAuthService.login(dto);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('olvide-password')
  solicitarReset(@Body() dto: SolicitarResetColaboradorDto) {
    return this.colaboradorAuthService.solicitarReset(dto.correo);
  }

  @Public()
  @Post('restablecer-password')
  restablecer(@Body() dto: RestablecerPasswordColaboradorDto) {
    return this.colaboradorAuthService.restablecer(dto.token, dto.nuevaPassword);
  }

  @UseGuards(ColaboradorAuthGuard)
  @PermitirPasswordPendiente()
  @Post('cambiar-password')
  cambiarPassword(@Body() dto: CambiarPasswordColaboradorDto, @CurrentColaborador('sub') colaboradorId: string) {
    return this.colaboradorAuthService.cambiarPassword(colaboradorId, dto.actual, dto.nueva);
  }
}
