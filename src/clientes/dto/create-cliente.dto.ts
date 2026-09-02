import {
  IsEnum,
  IsOptional,
  IsString,
  IsArray,
  IsEmail,
  ValidateIf,
} from 'class-validator';
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
  @IsString()
  cedula?: string;

  @IsOptional()
  @IsString()
  pasaporte?: string;

  @IsOptional()
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
  @IsOptional() @IsString() cedula?: string;
  @IsOptional() @IsString() pasaporte?: string;
  @IsOptional() @IsString() rnc?: string;
  @IsOptional() @IsString() nacionalidad?: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsArray() telefonos?: string[];
  @IsOptional() @IsEmail() correo?: string;
  @IsOptional() @IsString() personaContacto?: string;
  @IsOptional() @IsString() observaciones?: string;
  @IsOptional() @IsEnum(EstadoCliente) estado?: EstadoCliente;
}
