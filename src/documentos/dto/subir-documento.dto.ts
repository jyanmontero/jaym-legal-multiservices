import {
  IsEnum,
  IsOptional,
  IsString,
  IsBoolean,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { CategoriaDocumento } from '../../common/enums/index.js';

// Nota: al llegar como multipart/form-data, todos los campos del body
// llegan como strings; @Transform normaliza los booleanos.
const aBooleano = ({ value }: { value: any }) => value === true || value === 'true';

export class SubirDocumentoDto {
  @ValidateIf((o) => !o.clienteId)
  @IsString()
  expedienteId?: string;

  @ValidateIf((o) => !o.expedienteId)
  @IsString()
  clienteId?: string;

  @IsOptional()
  @IsString()
  carpeta?: string;

  @IsEnum(CategoriaDocumento)
  categoria: CategoriaDocumento;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  confidencial?: boolean;

  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  clienteVisible?: boolean;

  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;
}

// DTO liviano para subir una nueva versión de un documento existente: no
// requiere repetir categoria/expedienteId/clienteId, que se heredan de la
// versión anterior (ver DocumentosService.subirNuevaVersion).
export class NuevaVersionDocumentoDto {
  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;
}
