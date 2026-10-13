import { BadRequestException, Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { AsistenteService, type MensajeHistorial } from './asistente.service.js';
import { ConfirmarAccionAsistenteDto, MensajeAsistenteDto } from './dto/asistente.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayloadUsuario } from '../auth/decorators/current-user.decorator.js';
import { RolUsuario } from '../common/enums/index.js';

const TIPOS_FOTO = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']);

const opcionesFoto = {
  storage: memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
    if (!TIPOS_FOTO.has(file.mimetype)) {
      cb(new BadRequestException('Formato no permitido. Sube una foto (JPG, PNG, WebP o HEIC) o un PDF.'), false);
      return;
    }
    cb(null, true);
  },
};

function parsearHistorial(texto?: string): MensajeHistorial[] {
  if (!texto) return [];
  try {
    const datos = JSON.parse(texto);
    if (!Array.isArray(datos)) return [];
    return datos
      .filter((m) => m && (m.rol === 'usuario' || m.rol === 'asistente') && typeof m.texto === 'string')
      .map((m) => ({ rol: m.rol, texto: String(m.texto).slice(0, 2000) }));
  } catch {
    return [];
  }
}

@Controller('asistente')
export class AsistenteController {
  constructor(private readonly asistenteService: AsistenteService) {}

  // Limite propio (auditoría 14-sep-2026): cada mensaje es una llamada
  // real a la API de Anthropic -- ver misma nota en clientes.controller.ts.
  // Acepta JSON (solo texto) o multipart (texto + foto opcional).
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('mensaje')
  @UseInterceptors(FileInterceptor('foto', opcionesFoto))
  async mensaje(
    @Body() dto: MensajeAsistenteDto,
    @UploadedFile() foto: Express.Multer.File | undefined,
    @CurrentUser() usuario: JwtPayloadUsuario,
  ) {
    return this.asistenteService.procesarMensaje(
      dto.texto ?? '',
      { id: usuario.sub, rol: usuario.rol as RolUsuario },
      {
        foto: foto ? { buffer: foto.buffer, mimetype: foto.mimetype } : undefined,
        historial: parsearHistorial(dto.historial),
      },
    );
  }

  // Ejecuta una acción que el asistente PREPARÓ y la persona confirmó con el botón.
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('confirmar')
  confirmar(@Body() dto: ConfirmarAccionAsistenteDto, @CurrentUser() usuario: JwtPayloadUsuario) {
    return this.asistenteService.confirmarAccion(dto.token, { id: usuario.sub, rol: usuario.rol as RolUsuario });
  }
}
