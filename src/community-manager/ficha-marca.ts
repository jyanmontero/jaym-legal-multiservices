/**
 * Ficha única de marca y redes de JAYM Legal -- fuente de verdad que el
 * Community Manager usa para redactar y que la pantalla muestra para
 * verificar los perfiles. Decisiones confirmadas por Joseph el 5-oct-2026:
 * horario, correos, cargo "Fundador y CEO" y lista oficial de 8 servicios.
 * Cualquier cambio de datos de la firma se hace aquí, en un solo lugar.
 */

export type RedSocial =
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'threads'
  | 'x'
  | 'tiktok'
  | 'youtube'
  | 'google_business';

export const REDES: RedSocial[] = [
  'facebook',
  'instagram',
  'linkedin',
  'threads',
  'x',
  'tiktok',
  'youtube',
  'google_business',
];

export interface InfoRed {
  nombre: string;
  /** Máximo de caracteres del texto en esa red (o de la recomendación de lectura). */
  limite: number;
  /** true = el sistema publica solo cuando la conexión (token) está configurada. */
  automatica: boolean;
  /** Dónde se abre la red para publicar a mano o revisar el perfil. */
  urlPerfil: string;
  urlPublicar: string;
  /** Nota de estilo para la IA. */
  estilo: string;
}

export const INFO_REDES: Record<RedSocial, InfoRed> = {
  facebook: {
    nombre: 'Facebook',
    limite: 1200,
    automatica: true,
    urlPerfil: 'https://www.facebook.com/profile.php?id=61563976451136',
    urlPublicar: 'https://www.facebook.com/profile.php?id=61563976451136',
    estilo:
      'Párrafos cortos, tono cercano y profesional. Puede incluir el enlace del artículo. Cierra con una invitación a escribir al WhatsApp o al correo.',
  },
  instagram: {
    nombre: 'Instagram',
    limite: 2000,
    automatica: true,
    urlPerfil: 'https://www.instagram.com/jaym_legal_multiservices/',
    urlPublicar: 'https://www.instagram.com/jaym_legal_multiservices/',
    estilo:
      'Primera línea con gancho. NO pongas enlaces (no son clicables): di "enlace en la biografía". Termina con 5 a 8 hashtags relevantes (#LaRomana #DerechoDominicano y los del tema).',
  },
  linkedin: {
    nombre: 'LinkedIn',
    limite: 1500,
    automatica: true,
    urlPerfil: 'https://www.linkedin.com/in/licdo-joseph-a-montero-332ba856/',
    urlPublicar: 'https://www.linkedin.com/feed/',
    estilo:
      'Tono profesional y analítico, firmado desde la voz del Lic. Joseph Alcides Yan Montero, Fundador y CEO. Puede incluir el enlace. 3 a 5 hashtags al final.',
  },
  threads: {
    nombre: 'Threads',
    limite: 450,
    automatica: true,
    urlPerfil: 'https://www.threads.net/@jaym_group_multiservices',
    urlPublicar: 'https://www.threads.net/',
    estilo: 'Conversacional y breve, una sola idea. Máximo 1 hashtag.',
  },
  x: {
    nombre: 'X',
    limite: 270,
    automatica: false,
    urlPerfil: 'https://x.com/jaym_legend',
    urlPublicar: 'https://x.com/compose/post',
    estilo: 'Una idea directa en menos de 270 caracteres. Máximo 2 hashtags.',
  },
  tiktok: {
    nombre: 'TikTok',
    limite: 400,
    automatica: false,
    urlPerfil: 'https://www.tiktok.com/@jaymmultiservice',
    urlPublicar: 'https://www.tiktok.com/creator-center/upload',
    estilo:
      'Descripción corta para acompañar un video o foto: gancho en la primera frase y 3 a 5 hashtags (#abogado #larromana #derechodominicano).',
  },
  youtube: {
    nombre: 'YouTube (comunidad)',
    limite: 800,
    automatica: false,
    urlPerfil: 'https://www.youtube.com/@Jaymlegalmultiservices',
    urlPublicar: 'https://studio.youtube.com/',
    estilo:
      'Publicación de comunidad del canal "JAYM LEGAL 360: Jurisprudencia de Vida": tono didáctico, invita a ver el siguiente video o a comentar.',
  },
  google_business: {
    nombre: 'Google Business',
    limite: 1400,
    automatica: false,
    urlPerfil: 'https://business.google.com/',
    urlPublicar: 'https://business.google.com/',
    estilo:
      'Sin hashtags, sin teléfonos y sin enlaces dentro del texto (Google los rechaza). Útil y local: menciona La Romana.',
  },
};

export const FICHA_MARCA = {
  nombreComercial: 'JAYM Legal Multiservices',
  razonSocial: 'JAYM LEGAL MULTISERVICES S.R.L.',
  rnc: '133540772',
  lema: 'Defendiendo tus derechos con pasión y precisión',
  direccion:
    'Calle Emma Balaguer No. 08, esquina José Dolores, Villa Hermosa, La Romana, República Dominicana',
  telefonoWhatsapp: '(849) 464-4313',
  correoPublico: 'info@jaymlegalmultiservices.com',
  sitioWeb: 'jaymlegalmultiservices.com',
  portalInmobiliario: 'jaymportalinmobiliario.com',
  horario: 'Lunes a viernes, 8:00 AM a 5:00 PM. Sábado solo con cita. Domingo cerrado.',
  cargoPublico: 'Fundador y CEO',
  /** Lista oficial de servicios (aprobada el 5-oct-2026). */
  servicios: [
    'Constitución y servicios corporativos',
    'Gestión inmobiliaria y títulos',
    'Trámites ante la Junta Central Electoral (JCE)',
    'Derecho de familia',
    'Migración',
    'Trámites administrativos y fiscales',
    'Documentos legales',
    'Litigio civil',
  ],
  /** Áreas que la firma NO ofrece como servicio. */
  noOfrecidos: ['Penal', 'Laboral', 'Administrativo (como litigio)'],
  descripcionCorta:
    'Firma legal en La Romana. Familia, civil, migratorio, corporativo, inmobiliario y cobros. Defendiendo tus derechos con pasión y precisión.',
  descripcionLarga:
    'JAYM Legal Multiservices es una firma legal en La Romana, República Dominicana. Asesoramos y representamos a personas, familias y empresas en derecho de familia, civil, migratorio, corporativo, inmobiliario y cobros, además de trámites notariales y documentales. Ofrecemos atención personalizada, seguimiento directo de cada caso y presupuesto claro antes de iniciar cualquier trámite. Defendiendo tus derechos con pasión y precisión.',
  bios: {
    instagram:
      'Firma legal en La Romana, RD\nFamilia · Civil · Migratorio · Corporativo · Inmobiliario\nL-V 8am-5pm\nDefendiendo tus derechos con pasión y precisión',
    threads:
      'Firma legal en La Romana, RD. Familia, civil, migratorio, corporativo e inmobiliario. Defendiendo tus derechos con pasión y precisión.',
    tiktok: 'Firma legal en La Romana, RD. Defendiendo tus derechos con pasión y precisión.',
    whatsappAusencia:
      'Gracias por escribir a JAYM Legal Multiservices. Nuestro horario es de lunes a viernes, de 8:00 AM a 5:00 PM; los sábados atendemos solo con cita y los domingos no laboramos. Te responderemos en cuanto abramos.',
  },
};
