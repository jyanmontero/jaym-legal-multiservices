import { IsOptional, IsString, MinLength } from 'class-validator';

export class GenerarBorradorCompletoDto {
  @IsOptional()
  @IsString()
  destinatario?: string;

  @IsOptional()
  @IsString()
  asunto?: string;

  @IsString()
  @MinLength(1)
  descripcionSituacion: string;
}
