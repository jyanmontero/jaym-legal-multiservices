import { Injectable, BadRequestException, ConflictException, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientesService } from '../clientes/clientes.service.js';
import { TipoCliente } from '../common/enums/index.js';

interface DatosContacto {
  nombre?: string;
  correo?: string;
  telefono?: string;
  mensaje?: string;
}

function limpiar(valor: unknown, maxLargo: number): string | undefined {
  if (typeof valor !== 'string') return undefined;
  const recortado = valor.trim().slice(0, maxLargo);
  return recortado.length > 0 ? recortado : undefined;
}

function buscarPorAlias(valores: Record<string, string>, alias: string[]): string | undefined {
  for (const clave of Object.keys(valores)) {
    if (alias.some((a) => clave.includes(a))) return valores[clave];
  }
  return undefined;
}

/**
 * Recibe leads del formulario de contacto/citas de jaymlegalmultiservices.com
 * (sitio de marketing en WordPress/Elementor) y crea automáticamente un
 * Cliente en estado PROSPECTO -- sección "conectar el formulario del sitio
 * con el sistema de gestión" acordada el 24/09/2026.
 *
 * IMPORTANTE sobre el formato del envío: no existe una API oficial de
 * Elementor que se pueda "inventar" aquí (la propia instrucción del proyecto
 * prohíbe inventar integraciones), así que este servicio NO asume una
 * estructura fija de payload. Se diseñó para aceptar la acción nativa
 * "Webhook" de Elementor Pro, que envía la petición POST desde el SERVIDOR
 * de WordPress (no desde el navegador del visitante) -- por eso no hace
 * falta tocar la configuración de CORS del backend. Elementor puede enviar
 * los campos de dos formas típicas, y ambas se soportan:
 *   1) Plana: { name/nombre, email/correo, phone/telefono, message/mensaje }
 *   2) Anidada (fields por id): { fields: { nombre_del_campo: { value } } }
 * Si el campo real de Elementor usa otro nombre, basta con revisar un envío
 * de prueba y ajustar los `alias` de buscarPorAlias() -- no hace falta
 * tocar el resto del flujo.
 */
@Injectable()
export class ContactoWebService {
  private readonly logger = new Logger(ContactoWebService.name);

  constructor(
    private readonly clientesService: ClientesService,
    private readonly config: ConfigService,
  ) {}

  private verificarClave(claveRecibida?: string): void {
    const claveEsperada = this.config.get<string>('CONTACTO_WEB_SECRET');
    if (!claveEsperada) {
      // Igual criterio que obtenerJwtSecretObligatorio(): este endpoint crea
      // clientes reales sin sesión -- mejor fallar ruidosamente al recibir
      // el primer envío que arrancar "abierto" a cualquiera en internet.
      throw new Error(
        'Falta configurar CONTACTO_WEB_SECRET en el .env -- es obligatoria para aceptar envíos del formulario público del sitio web.',
      );
    }
    if (!claveRecibida || claveRecibida !== claveEsperada) {
      throw new UnauthorizedException('Clave de formulario inválida o ausente.');
    }
  }

  private normalizar(body: Record<string, unknown>): DatosContacto {
    const plano = body ?? {};

    // Forma 1: campos planos (nombres en español o inglés).
    const nombrePlano = limpiar((plano as any).nombre ?? (plano as any).name ?? (plano as any).nombre_completo, 200);
    const correoPlano = limpiar((plano as any).correo ?? (plano as any).email, 200);
    const telefonoPlano = limpiar((plano as any).telefono ?? (plano as any).phone ?? (plano as any).tel ?? (plano as any).celular, 50);
    const mensajePlano = limpiar((plano as any).mensaje ?? (plano as any).message ?? (plano as any).comments ?? (plano as any).comentario, 2000);
    if (nombrePlano || correoPlano || telefonoPlano) {
      return { nombre: nombrePlano, correo: correoPlano, telefono: telefonoPlano, mensaje: mensajePlano };
    }

    // Forma 2: payload anidado de Elementor Pro ({ fields: { id: { value } } }).
    const fields = (plano as any).fields;
    if (fields && typeof fields === 'object') {
      const valores: Record<string, string> = {};
      for (const key of Object.keys(fields)) {
        const campo = (fields as any)[key];
        const valor = typeof campo === 'string' ? campo : campo?.value;
        if (typeof valor !== 'string' || valor.trim().length === 0) continue;
        const idNormalizado = String(campo?.id ?? key).toLowerCase();
        valores[idNormalizado] = valor.trim();
      }
      return {
        nombre: limpiar(buscarPorAlias(valores, ['nombre', 'name']), 200),
        correo: limpiar(buscarPorAlias(valores, ['correo', 'email', 'e-mail']), 200),
        telefono: limpiar(buscarPorAlias(valores, ['telefono', 'phone', 'tel', 'celular']), 50),
        mensaje: limpiar(buscarPorAlias(valores, ['mensaje', 'message', 'comment']), 2000),
      };
    }

    return {};
  }

  async procesarEnvio(body: Record<string, unknown>, claveRecibida?: string) {
    this.verificarClave(claveRecibida);

    const datos = this.normalizar(body);
    if (!datos.nombre && !datos.correo && !datos.telefono) {
      throw new BadRequestException(
        'El formulario no incluyó nombre, correo ni teléfono -- no se puede crear un prospecto vacío.',
      );
    }

    const nombre = datos.nombre ?? 'Prospecto del sitio web';
    const notaOrigen = `[Formulario web ${new Date().toISOString()}] ${datos.mensaje ?? 'Sin mensaje adicional.'}`;

    // La detección de duplicados del sistema (ClientesService) solo cubre
    // cédula/pasaporte/RNC/correo -- el teléfono nunca tuvo índice único, así
    // que aquí también se limita a correo, igual que en el resto del
    // sistema. Si ya existe un cliente con ese correo, se agrega el mensaje
    // como una nota nueva en vez de crear un duplicado.
    if (datos.correo) {
      const duplicados = await this.clientesService.detectarDuplicados({ correo: datos.correo });
      const porCorreo = duplicados.find((d) => d.campo === 'correo');
      if (porCorreo) {
        const cliente = porCorreo.clienteExistente;
        const observaciones = [cliente.observaciones, notaOrigen].filter(Boolean).join('\n');
        await this.clientesService.actualizar(cliente.id, { observaciones });
        this.logger.log(`Nuevo contacto del sitio web para cliente existente ${cliente.codigoCliente} (${cliente.correo}).`);
        return { recibido: true, clienteExistente: true };
      }
    }

    try {
      const resultado = await this.clientesService.crear({
        tipo: TipoCliente.FISICO,
        nombres: nombre,
        apellidos: undefined,
        // La dirección y nacionalidad son obligatorias en el modelo de
        // Cliente (se piden en el registro manual) pero un formulario de
        // contacto no las levanta -- se deja un valor explícito de
        // "pendiente" en vez de inventar un dato, para que el staff sepa
        // que debe completarlo en la primera llamada/reunión con el
        // prospecto.
        nacionalidad: 'Pendiente de confirmar',
        direccion: 'Pendiente de confirmar (prospecto vía formulario web)',
        telefonos: datos.telefono ? [datos.telefono] : [],
        correo: datos.correo,
        observaciones: notaOrigen,
      });

      if (resultado.duplicados) {
        // Carrera improbable (alguien creó el mismo correo entre la
        // detección de arriba y este insert) -- no se pierde el lead, solo
        // se informa como duplicado en vez de fallar.
        return { recibido: true, clienteExistente: true };
      }

      this.logger.log(`Prospecto creado desde el formulario web: ${resultado.cliente?.codigoCliente}.`);
      return { recibido: true, clienteId: resultado.cliente?.id };
    } catch (err) {
      if (err instanceof ConflictException) {
        return { recibido: true, clienteExistente: true };
      }
      throw err;
    }
  }
}
