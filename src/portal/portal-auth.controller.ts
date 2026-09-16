import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PortalAuthService } from './portal-auth.service.js';
import { LoginPortalDto, SolicitarResetPortalDto, RestablecerPasswordPortalDto, CambiarPasswordPortalDto } from './dto/portal-auth.dto.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { PortalAuthGuard } from './portal-auth.guard.js';
import { CurrentPortalUsuario } from './current-portal-usuario.decorator.js';

@Controller('portal/auth')
export class PortalAuthController {
  constructor(private readonly portalAuthService: PortalAuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  login(@Body() dto: LoginPortalDto) {
    return this.portalAuthService.login(dto);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('olvide-password')
  solicitarReset(@Body() dto: SolicitarResetPortalDto) {
    return this.portalAuthService.solicitarReset(dto.correo);
  }

  @Public()
  @Post('restablecer-password')
  restablecer(@Body() dto: RestablecerPasswordPortalDto) {
    return this.portalAuthService.restablecer(dto.token, dto.nuevaPassword);
  }

  @UseGuards(PortalAuthGuard)
  @Post('cambiar-password')
  cambiarPassword(@Body() dto: CambiarPasswordPortalDto, @CurrentPortalUsuario('sub') portalUsuarioId: string) {
    return this.portalAuthService.cambiarPassword(portalUsuarioId, dto.actual, dto.nueva);
  }
}
