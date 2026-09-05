import {
  IsEnum,
  IsOptional,
  IsString,
  IsArray,
  IsEmail,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

// El frontend a veces manda "" (cadena vacia) en vez de omitir un campo
// opcional cuando el usuario deja una casilla en blanco. @IsOptional() de
// class-validator solo se salta la validacion si el valor es null/undefined,
// no si es "" — sin este Transform, un correo vacio caia en @IsEmail() y
// tiraba el error tecnico "correo must be an email" en vez de simplemente
// aceptarse como "no se dio correo". Mismo criterio aplicado en UpdateClienteDto,
// y también a cedula/pasaporte/rnc: los tres tienen un índice único parcial
// ("WHERE columna IS NOT NULL") que NO excluye la cadena vacía, así que dos
// clientes con cedula="" chocan como si fueran un duplicado real y el
// guardado revienta con un 500 sin este Transform (hallazgo del 04/09/2026).
const vacioComoIndefinido = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;
import { TipoCliente, EstadoCivil, EstadoCliente } from '../../common/enums/index.js';

export class CreateClienteDto {
  @IsEnum(TipoCliente)
  tipo: TipoCliente;

  // Persona física
  @ValidateIf((o) => o.tipo === TipoCliente.FISICO)
  @IsString()
  nombres?: string;

  @ValidateIf((o) => o.tipo === TipoCliente.FISICO)
  @IsString()
  apellidos?: string;

  @IsOptional()
  @IsString()
  fechaNacimiento?: string;

  @IsOptional()
  @IsEnum(EstadoCivil)
  estadoCivil?: EstadoCivil;

  @IsOptional()
  @IsString()
  ocupacion?: string;

  // Persona jurídica
  @ValidateIf((o) => o.tipo === TipoCliente.JURIDICO)
  @IsString()
  razonSocial?: string;

  @IsOptional()
  @IsString()
  nombreComercial?: string;

  @IsOptional()
  @IsString()
  registroMercantil?: string;

  @IsOptional()
  @IsString()
  domicilioSocial?: string;

  @IsOptional()
  @IsString()
  representanteLegal?: string;

  @IsOptional()
  @IsString()
  cedulaOPasaporteRepresentante?: string;

  @IsOptional()
  @IsString()
  actividadComercial?: string;

  // Identificación compartida
  @IsOptional()
  @Transform(vacioComoIndefinido)
  @IsString()
  cedula?: string;

  @IsOptional()
  @Transform(vacioComoIndefinido)
  @IsString()
  pasaporte?: string;

  @IsOptional()
  @Transform(vacioComoIndefinido)
  @IsString()
  rnc?: string;

  @IsString()
  nacionalidad: string;

  @IsString()
  direccion: string;

  @IsOptional()
  @IsArray()
  telefonos?: string[];

  @IsOptional()
  @Transform(vacioComoIndefinido)
  @IsEmail()
  correo?: string;

  @IsOptional()
  @IsString()
  personaContacto?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

// Todos los campos opcionales — solo se actualiza lo que se envía. No
// incluye `tipo` (cambiar de física a jurídica no tiene sentido de negocio;
// si se necesita, se crea un cliente nuevo).
export class UpdateClienteDto {
  @IsOptional() @IsString() nombres?: string;
  @IsOptional() @IsString() apellidos?: string;
  @IsOptional() @IsString() fechaNacimiento?: string;
  @IsOptional() @IsEnum(EstadoCivil) estadoCivil?: EstadoCivil;
  @IsOptional() @IsString() ocupacion?: string;
  @IsOptional() @IsString() razonSocial?: string;
  @IsOptional() @IsString() nombreComercial?: string;
  @IsOptional() @IsString() registroMercantil?: string;
  @IsOptional() @IsString() domicilioSocial?: string;
  @IsOptional() @IsString() representanteLegal?: string;
  @IsOptional() @IsString() cedulaOPasaporteRepresentante?: string;
  @IsOptional() @IsString() actividadComercial?: string;
  @IsOptional() @Transform(vacioComoIndefinido) @IsString() cedula?: string;
  @IsOptional() @Transform(vacioComoIndefinido) @IsString() pasaporte?: string;
  @IsOptional() @Transform(vacioComoIndefinido) @IsString() rnc?: string;
  @IsOptional() @IsString() nacionalidad?: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsArray() telefonos?: string[];
  @IsOptional() @Transform(vacioComoIndefinido) @IsEmail() correo?: string;
  @IsOptional() @IsString() personaContacto?: string;
  @IsOptional() @IsString() observaciones?: string;
  @IsOptional() @IsEnum(EstadoCliente) estado?: EstadoCliente;
}
