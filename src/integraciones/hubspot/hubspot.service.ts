import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cliente } from '../../clientes/cliente.entity.js';
import { Expediente } from '../../expedientes/expediente.entity.js';
import { TipoCliente } from '../../common/enums/index.js';
import {
  PROPIEDADES_CONTACTO_JAYM,
  PROPIEDADES_DEAL_JAYM,
  ETAPA_POR_ESTADO,
  NOMBRE_PIPELINE_JAYM,
  NOMBRES_ETAPAS_JAYM,
  type EtapaHubSpot,
} from './hubspot.constants.js';

const API_BASE = 'https://api.hubapi.com';

interface RespuestaBusqueda {
  results: { id: string }[];
}

/**
 * Sincronización JAYM LEGAL -> HubSpot (un solo sentido, "push").
 *
 * Importante: este backend corre en la computadora local del despacho, sin
 * URL pública — HubSpot no puede entregarle webhooks (no hay a dónde
 * mandarlos). Por eso esta integración es "on-demand": un botón en la
 * interfaz llama a estos métodos y empujan el estado actual hacia HubSpot.
 * Si en el futuro el backend se aloja en un servidor con URL pública, se
 * puede añadir un endpoint receptor de webhooks para que también sea
 * bidireccional.
 *
 * Requiere HUBSPOT_ACCESS_TOKEN (Private App token del portal, con scopes
 * crm.objects.contacts.write y crm.objects.deals.write) y, para negocios,
 * HUBSPOT_PIPELINE_ID + las 4 variables HUBSPOT_STAGE_* — ver .env.example.
 */
@Injectable()
export class HubSpotService {
  private readonly logger = new Logger(HubSpotService.name);

  constructor(private readonly config: ConfigService) {}

  private token(): string {
    const token = this.config.get<string>('HUBSPOT_ACCESS_TOKEN');
    if (!token) {
      throw new InternalServerErrorException(
        'HUBSPOT_ACCESS_TOKEN no está configurado. Genera un Private App token en HubSpot ' +
          '(Configuración > Integraciones > Private Apps, portal 51539725) con permisos de ' +
          'lectura/escritura de contactos y negocios, y agrégalo al archivo .env del backend.',
      );
    }
    return token;
  }

  private async llamar<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
    const respuesta = await fetch(`${API_BASE}${ruta}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${this.token()}`,
        'Content-Type': 'application/json',
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });

    if (!respuesta.ok) {
      const texto = await respuesta.text().catch(() => '');
      this.logger.error(`HubSpot ${metodo} ${ruta} -> ${respuesta.status}: ${texto}`);
      throw new InternalServerErrorException(
        `HubSpot respondió con error ${respuesta.status} al sincronizar. Detalle: ${texto || 'sin detalle'}`,
      );
    }
    if (respuesta.status === 204) return undefined as T;
    return (await respuesta.json()) as T;
  }

  // --- Contactos (Cliente -> HubSpot Contact) ------------------------------

  private nombreCliente(cliente: Cliente): { firstname?: string; lastname?: string; company?: string } {
    if (cliente.tipo === TipoCliente.JURIDICO) {
      return { company: cliente.razonSocial ?? cliente.nombreComercial, lastname: cliente.representanteLegal };
    }
    return { firstname: cliente.nombres, lastname: cliente.apellidos };
  }

  /**
   * Busca un contacto existente por el código interno de cliente (evita
   * duplicados en re-sincronizaciones); si no existe lo crea, si existe lo
   * actualiza. Devuelve el ID del contacto en HubSpot.
   */
  async sincronizarContacto(cliente: Cliente): Promise<string> {
    const propiedades: Record<string, string> = {
      ...this.nombreCliente(cliente),
      [PROPIEDADES_CONTACTO_JAYM.codigoCliente]: cliente.codigoCliente,
      [PROPIEDADES_CONTACTO_JAYM.cedulaORnc]: cliente.cedula ?? cliente.rnc ?? cliente.pasaporte ?? '',
      [PROPIEDADES_CONTACTO_JAYM.tipoCliente]: cliente.tipo,
      address: cliente.direccion,
      phone: cliente.telefonos?.[0] ?? '',
    };
    if (cliente.correo) propiedades.email = cliente.correo;

    const existente = await this.buscarPorPropiedad(
      'contacts',
      PROPIEDADES_CONTACTO_JAYM.codigoCliente,
      cliente.codigoCliente,
    );

    if (existente) {
      await this.llamar('PATCH', `/crm/v3/objects/contacts/${existente}`, { properties: propiedades });
      return existente;
    }
    const creado = await this.llamar<{ id: string }>('POST', '/crm/v3/objects/contacts', { properties: propiedades });
    return creado.id;
  }

  // --- Negocios (Expediente -> HubSpot Deal) -------------------------------

  async sincronizarExpediente(expediente: Expediente, cliente: Cliente): Promise<string> {
    const { pipelineId, etapas } = await this.obtenerPipeline();
    const etapa = ETAPA_POR_ESTADO[expediente.estado];
    const stageId = etapas[etapa];
    if (!stageId) {
      throw new InternalServerErrorException(
        `El pipeline "${NOMBRE_PIPELINE_JAYM}" en HubSpot no tiene una etapa llamada "${NOMBRES_ETAPAS_JAYM[etapa]}". ` +
          'Revisa que los 5 nombres de etapa coincidan exactamente con los del README de esta carpeta.',
      );
    }

    const propiedades: Record<string, string> = {
      dealname: `${expediente.codigo} — ${expediente.materia.replace(/_/g, ' ')}`,
      pipeline: pipelineId,
      dealstage: stageId,
      [PROPIEDADES_DEAL_JAYM.codigoExpediente]: expediente.codigo,
      [PROPIEDADES_DEAL_JAYM.tipoCaso]: expediente.materia,
      [PROPIEDADES_DEAL_JAYM.balancePendiente]: expediente.balancePendiente,
    };
    if (expediente.honorariosAcordados) propiedades.amount = expediente.honorariosAcordados;

    const existente = await this.buscarPorPropiedad(
      'deals',
      PROPIEDADES_DEAL_JAYM.codigoExpediente,
      expediente.codigo,
    );

    let dealId: string;
    if (existente) {
      await this.llamar('PATCH', `/crm/v3/objects/deals/${existente}`, { properties: propiedades });
      dealId = existente;
    } else {
      const creado = await this.llamar<{ id: string }>('POST', '/crm/v3/objects/deals', { properties: propiedades });
      dealId = creado.id;
    }

    const contactoId = await this.sincronizarContacto(cliente);
    await this.asociarDealConContacto(dealId, contactoId);
    return dealId;
  }

  // Caché en memoria — el pipeline casi nunca cambia de estructura, así
  // que no vale la pena consultarlo a HubSpot en cada sincronización.
  private pipelineCache: { pipelineId: string; etapas: Partial<Record<EtapaHubSpot, string>> } | null = null;

  /**
   * Busca el pipeline "Casos JAYM LEGAL" por NOMBRE (no por ID guardado a
   * mano) y arma un mapa etapa-interna -> ID real de HubSpot, buscando
   * cada etapa también por su nombre exacto. Si el pipeline no existe
   * todavía, lanza un error explicando que hay que crearlo una vez en
   * HubSpot con el nombre y las 5 etapas indicadas en hubspot.constants.ts.
   */
  private async obtenerPipeline(): Promise<{ pipelineId: string; etapas: Partial<Record<EtapaHubSpot, string>> }> {
    if (this.pipelineCache) return this.pipelineCache;

    const respuesta = await this.llamar<{ results: { id: string; label: string; stages: { id: string; label: string }[] }[] }>(
      'GET',
      '/crm/v3/pipelines/deals',
    );
    const pipeline = respuesta.results.find((p) => p.label === NOMBRE_PIPELINE_JAYM);
    if (!pipeline) {
      throw new InternalServerErrorException(
        `No encontré en HubSpot un pipeline de negocios llamado exactamente "${NOMBRE_PIPELINE_JAYM}". ` +
          'Créalo una vez en HubSpot (Configuración > Objetos > Negocios > Pipelines) con ese nombre y sus 5 etapas — ver README de esta carpeta.',
      );
    }

    const etapas: Partial<Record<EtapaHubSpot, string>> = {};
    for (const [clave, nombreEtapa] of Object.entries(NOMBRES_ETAPAS_JAYM) as [EtapaHubSpot, string][]) {
      const etapaEncontrada = pipeline.stages.find((s) => s.label === nombreEtapa);
      if (etapaEncontrada) etapas[clave] = etapaEncontrada.id;
    }

    this.pipelineCache = { pipelineId: pipeline.id, etapas };
    return this.pipelineCache;
  }

  /** Fuerza a volver a leer el pipeline de HubSpot en la próxima sincronización. */
  refrescarCachePipeline(): void {
    this.pipelineCache = null;
  }

  private async asociarDealConContacto(dealId: string, contactoId: string): Promise<void> {
    // Tipo de asociación estándar deal-to-contact (definido por HubSpot).
    await this.llamar(
      'PUT',
      `/crm/v3/objects/deals/${dealId}/associations/contacts/${contactoId}/deal_to_contact`,
    );
  }

  /**
   * Crea (si no existen) las Custom Properties que este servicio necesita
   * para escribir cedula_rnc, código de cliente/expediente, materia y
   * balance en HubSpot. Es seguro llamarlo varias veces — cada propiedad
   * se crea una sola vez y las siguientes llamadas la encuentran y la
   * dejan igual. Ejecútalo una vez (POST /integraciones/hubspot/configurar)
   * antes de la primera sincronización real.
   */
  async asegurarPropiedades(): Promise<{ creadas: string[]; yaExistian: string[] }> {
    const definiciones: {
      objectType: 'contacts' | 'deals';
      name: string;
      label: string;
      groupName: string;
    }[] = [
      { objectType: 'contacts', name: PROPIEDADES_CONTACTO_JAYM.cedulaORnc, label: 'Cédula / RNC', groupName: 'contactinformation' },
      { objectType: 'contacts', name: PROPIEDADES_CONTACTO_JAYM.tipoCliente, label: 'Tipo de cliente (JAYM)', groupName: 'contactinformation' },
      { objectType: 'contacts', name: PROPIEDADES_CONTACTO_JAYM.codigoCliente, label: 'Código de cliente (JAYM)', groupName: 'contactinformation' },
      { objectType: 'deals', name: PROPIEDADES_DEAL_JAYM.codigoExpediente, label: 'Código de expediente (JAYM)', groupName: 'dealinformation' },
      { objectType: 'deals', name: PROPIEDADES_DEAL_JAYM.tipoCaso, label: 'Materia jurídica (JAYM)', groupName: 'dealinformation' },
      { objectType: 'deals', name: PROPIEDADES_DEAL_JAYM.balancePendiente, label: 'Balance pendiente RD$ (JAYM)', groupName: 'dealinformation' },
    ];

    const creadas: string[] = [];
    const yaExistian: string[] = [];

    for (const def of definiciones) {
      const existe = await this.propiedadExiste(def.objectType, def.name);
      if (existe) {
        yaExistian.push(def.name);
        continue;
      }
      await this.llamar('POST', `/crm/v3/properties/${def.objectType}`, {
        name: def.name,
        label: def.label,
        groupName: def.groupName,
        type: 'string',
        fieldType: 'text',
      });
      creadas.push(def.name);
    }

    return { creadas, yaExistian };
  }

  private async propiedadExiste(objectType: 'contacts' | 'deals', nombre: string): Promise<boolean> {
    const respuesta = await fetch(`${API_BASE}/crm/v3/properties/${objectType}/${nombre}`, {
      headers: { Authorization: `Bearer ${this.token()}` },
    });
    return respuesta.ok;
  }

  private async buscarPorPropiedad(
    objectType: 'contacts' | 'deals',
    propiedad: string,
    valor: string,
  ): Promise<string | null> {
    const resultado = await this.llamar<RespuestaBusqueda>('POST', `/crm/v3/objects/${objectType}/search`, {
      filterGroups: [{ filters: [{ propertyName: propiedad, operator: 'EQ', value: valor }] }],
      limit: 1,
    });
    return resultado.results[0]?.id ?? null;
  }
}
