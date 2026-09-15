import { IsIn, IsString, MinLength } from 'class-validator';

export class ExportarDocxDto {
  @IsIn(['instancia', 'carta', 'informe', 'otro'])
  tipoDocumento: 'instancia' | 'carta' | 'informe' | 'otro';

  @IsString()
  @MinLength(1)
  texto: string;
}
