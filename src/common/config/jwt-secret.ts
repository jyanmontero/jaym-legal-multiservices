import { ConfigService } from '@nestjs/config';

/**
 * JWT_SECRET usado en dos lugares (AuthModule al firmar, JwtStrategy al
 * verificar) -- antes ambos caían silenciosamente a un valor de respaldo
 * ('inseguro-cambiar-en-.env') visible en el propio código fuente si la
 * variable faltaba en el .env. Eso significaba que, en un ambiente nuevo
 * desplegado sin fijar JWT_SECRET, cualquiera que leyera el repositorio
 * podía fabricar un token válido para cualquier usuario (hallazgo de la
 * auditoría de resistencia y seguridad). Mismo criterio ya aplicado a
 * DOS_FACTOR_CLAVE_CIFRADO en common/cifrado/cifrado.service.ts: fallar
 * ruidosamente al arrancar en vez de arrancar "bien" con un secreto
 * conocido por cualquiera.
 */
export function obtenerJwtSecretObligatorio(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  if (!secret) {
    throw new Error(
      'Falta configurar JWT_SECRET en el .env -- es obligatoria para firmar y verificar las sesiones.',
    );
  }
  return secret;
}
