import { IsIn, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { CATALOGO_PLANTILLAS } from '../plantillas-catalogo.js';

const CLAVES_VALIDAS = CATALOGO_PLANTILLAS.map((p) => p.clave);

export class CrearSolicitudDocumentoDto {
  @IsIn(CLAVES_VALIDAS)
  plantillaClave: string;

  @IsOptional()
  @IsUUID()
  expedienteId?: string;

  @IsOptional()
  @IsUUID()
  clienteId?: string;

  // Valores que el personal interno ya conoce y quiere dejar precargados
  // (ej. el nombre y la cédula del cliente), para que la persona solo
  // tenga que completar lo que falta.
  @IsOptional()
  @IsObject()
  datosPrellenados?: Record<string, string>;

  @IsOptional()
  @IsString()
  notasInternas?: string;
}
