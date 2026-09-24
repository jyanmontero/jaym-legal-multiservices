import { IsOptional, IsString } from 'class-validator';

export class AsignarExpedienteColaboradorDto {
  @IsString()
  expedienteId: string;

  @IsOptional()
  @IsString()
  notas?: string;
}
