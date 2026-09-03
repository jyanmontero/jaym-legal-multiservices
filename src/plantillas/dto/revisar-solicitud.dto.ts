import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class RevisarSolicitudDocumentoDto {
  @IsBoolean()
  aprobar: boolean;

  // Motivo de las correcciones pedidas, cuando aprobar = false. Se muestra
  // al cliente al volver a abrir su mismo enlace.
  @IsOptional()
  @IsString()
  motivoRechazo?: string;

  // Permite que el revisor corrija directamente una errata puntual antes
  // de aprobar (ej. una cédula mal escrita), sin tener que rechazar y
  // esperar a que el cliente reenvíe todo el formulario.
  @IsOptional()
  @IsObject()
  datosCorregidos?: Record<string, string>;
}
