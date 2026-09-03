import { IsIn } from 'class-validator';
import { CATALOGO_PLANTILLAS } from '../plantillas-catalogo.js';

const CLAVES_VALIDAS = CATALOGO_PLANTILLAS.map((p) => p.clave);

export class IniciarSolicitudPublicaDto {
  @IsIn(CLAVES_VALIDAS)
  plantillaClave: string;
}
