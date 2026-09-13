import { IsOptional, IsString, MinLength } from 'class-validator';

export class GenerarFundamentoDto {
  @IsOptional()
  @IsString()
  destinatario?: string;

  @IsOptional()
  @IsString()
  asunto?: string;

  @IsString()
  @MinLength(1)
  hechos: string;
}
