import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITMO = 'aes-256-gcm';

/**
 * Cifrado simétrico en reposo para datos sensibles -- hoy solo lo usa el
 * secreto TOTP de 2FA (usuarios/usuarios.service.ts), que antes se
 * guardaba en texto plano en la base de datos (riesgo menor ya documentado
 * en usuario.entity.ts).
 *
 * La clave sale de DOS_FACTOR_CLAVE_CIFRADO -- cualquier texto sirve como
 * passphrase, se deriva una clave AES de 32 bytes con SHA-256 para no
 * exigir un valor con formato exacto (mismo criterio que JWT_SECRET).
 */
@Injectable()
export class CifradoService {
  constructor(private readonly config: ConfigService) {}

  private clave(): Buffer {
    const passphrase = this.config.get<string>('DOS_FACTOR_CLAVE_CIFRADO');
    if (!passphrase) {
      throw new Error(
        'Falta configurar DOS_FACTOR_CLAVE_CIFRADO en el .env -- es obligatoria para activar o verificar 2FA.',
      );
    }
    return crypto.createHash('sha256').update(passphrase).digest();
  }

  cifrar(texto: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITMO, this.clave(), iv);
    const cifrado = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Formato: iv.tag.cifrado, cada parte en base64 -- todo lo necesario
    // para descifrar queda junto al propio valor guardado.
    return [iv, tag, cifrado].map((b) => b.toString('base64')).join('.');
  }

  /**
   * Tolera secretos guardados en texto plano ANTES de este cambio (no hubo
   * migración de datos para no duplicar la lógica de cifrado dentro de una
   * migración): si el valor no tiene el formato "iv.tag.cifrado", se asume
   * texto plano y se devuelve tal cual, sin requerir la clave. La próxima
   * vez que ese usuario reactive 2FA, el secreto nuevo sí queda cifrado.
   */
  descifrar(valor: string): string {
    const partes = valor.split('.');
    if (partes.length !== 3) return valor;

    const [ivB64, tagB64, cifradoB64] = partes;
    try {
      const decipher = crypto.createDecipheriv(ALGORITMO, this.clave(), Buffer.from(ivB64, 'base64'));
      decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(cifradoB64, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // Si algo con esa forma no descifra (clave distinta, dato corrupto),
      // no hay forma segura de recuperarlo -- mejor fallar la verificación
      // del código 2FA que devolver un secreto incorrecto silenciosamente.
      throw new Error('No se pudo descifrar el secreto de 2FA');
    }
  }
}
