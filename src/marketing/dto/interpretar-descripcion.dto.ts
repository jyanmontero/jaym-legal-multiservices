import { IsString, MinLength } from 'class-validator';

// Entrada de la "carga rápida": texto libre (escrito o dictado por voz en
// el navegador) describiendo la propiedad, que la IA convierte en los
// mismos campos que pide CrearAnuncioDto. Nunca crea nada por sí sola --
// solo devuelve una sugerencia para que el usuario la revise antes de
// generar el anuncio (mismo criterio del resto del sistema).
export class InterpretarDescripcionDto {
  @IsString()
  @MinLength(10, { message: 'Describe la propiedad con al menos un par de frases.' })
  descripcion: string;
}
