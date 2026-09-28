import { MateriaJuridica } from '../common/enums/index.js';
import { MARCA_CORPORATIVA } from '../common/constants/marca-corporativa.js';

/**
 * Diseño editorial del artículo -- misma plantilla aprobada por Joseph
 * (encabezado con antetítulo/bajada, panel de cifras, cita destacada, firma
 * y pie con los datos de la firma) que usa el sistema (ver
 * src/pages/blog-articulo.css y ArticuloEditorial en BlogPage.tsx del
 * frontend). Esta versión es la que de verdad llega a WordPress: como el
 * editor de WordPress no carga ningún CSS del sistema, todo (fuentes,
 * colores, tipografía) viaja embebido en el propio HTML del post.
 *
 * A diferencia de la vista del sistema, aquí NO se repite el círculo "JL" /
 * nombre de la firma / lema -- eso ya lo muestra la cabecera del sitio de
 * WordPress en cada página; repetirlo se vería duplicado. Tampoco se repite
 * el título ni el autor: WordPress ya los muestra con su propia plantilla
 * (post_title / autor / fecha) justo antes de este HTML. Lo que sí se agrega
 * aquí es el antetítulo, la bajada (extracto) y el pie con los datos de
 * contacto de la firma, que WordPress no tiene forma de generar solo.
 */

const ETIQUETAS_AREA_KICKER: Record<MateriaJuridica, string> = {
  [MateriaJuridica.CIVIL]: 'Derecho Civil',
  [MateriaJuridica.COMERCIAL]: 'Derecho Comercial',
  [MateriaJuridica.PENAL]: 'Derecho Penal',
  [MateriaJuridica.LABORAL]: 'Derecho Laboral',
  [MateriaJuridica.FAMILIA]: 'Derecho de Familia',
  [MateriaJuridica.INMOBILIARIO]: 'Derecho Inmobiliario',
  [MateriaJuridica.MIGRATORIO]: 'Derecho Migratorio',
  [MateriaJuridica.ADMINISTRATIVO]: 'Derecho Administrativo',
  [MateriaJuridica.CONSTITUCIONAL]: 'Derecho Constitucional',
  [MateriaJuridica.REGISTRO_CIVIL_JCE]: 'Registro Civil y JCE',
  [MateriaJuridica.NOTARIAL]: 'Derecho Notarial',
  [MateriaJuridica.CORPORATIVO]: 'Derecho Corporativo',
  [MateriaJuridica.PROPIEDAD_INTELECTUAL]: 'Propiedad Intelectual',
  [MateriaJuridica.COBROS]: 'Cobros',
  [MateriaJuridica.PROTECCION_CONSUMIDOR]: 'Protección al Consumidor',
  [MateriaJuridica.SEGURIDAD_SOCIAL]: 'Seguridad Social',
  [MateriaJuridica.OTRA]: 'JAYM Legal',
};

// Un único bloque <style> con todas las reglas -- WordPress lo respeta tal
// cual porque el usuario "JAYM LEGAL" es Administrador (unfiltered_html) en
// un WordPress de un solo sitio. Todo bajo .aj-articulo-wp para no chocar
// con el CSS del tema del sitio.
const ESTILOS_WP = `
<style>
  .aj-articulo-wp{--aj-ink:#1c2a3a;--aj-ink-soft:#3c4a5c;--aj-paper-raised:#efe9db;--aj-gold:#a9822f;--aj-burgundy:#6d2733;--aj-rule:#c9bfa4;--aj-max:680px;
    max-width:var(--aj-max);margin:0 auto;font-family:"Source Serif 4",Georgia,"Times New Roman",serif;line-height:1.65;color:var(--aj-ink);}
  .aj-articulo-wp .aj-sans{font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
  .aj-articulo-wp .aj-kicker{font-family:"Inter",sans-serif;font-size:0.78rem;letter-spacing:0.12em;color:var(--aj-burgundy);font-weight:600;margin:0 0 14px;text-transform:uppercase;}
  .aj-articulo-wp .aj-dek{font-size:1.1rem;color:var(--aj-ink-soft);font-style:italic;margin:0 0 20px;}
  .aj-articulo-wp .aj-rule-fina{height:1px;background:var(--aj-rule);margin:0 0 2em;}
  .aj-articulo-wp h2{font-size:1.35rem;font-weight:600;margin:1.6em 0 0.7em;color:var(--aj-ink);}
  .aj-articulo-wp h3{font-size:1.12rem;font-weight:600;margin:1.4em 0 0.6em;color:var(--aj-ink);}
  .aj-articulo-wp p{margin:0 0 1.25em;font-size:1.05rem;}
  .aj-articulo-wp ol,.aj-articulo-wp ul{margin:0 0 1.4em;padding-left:1.3em;}
  .aj-articulo-wp li{margin-bottom:0.9em;font-size:1.03rem;}
  .aj-articulo-wp li strong{color:var(--aj-ink);}
  .aj-articulo-wp blockquote{margin:2.2em 0;padding:1.4em 1.7em;background:var(--aj-paper-raised);border-left:3px solid var(--aj-gold);font-style:italic;font-size:1.12rem;color:var(--aj-ink);line-height:1.5;}
  .aj-articulo-wp dl.cifras{background:var(--aj-paper-raised);border:1px solid var(--aj-rule);border-radius:2px;padding:1.4em 1.6em;margin:1.8em 0 2.2em;font-family:"Inter",sans-serif;display:grid;grid-template-columns:1fr 1fr;gap:1em 1.6em;}
  @media (max-width:480px){.aj-articulo-wp dl.cifras{grid-template-columns:1fr;}}
  .aj-articulo-wp dl.cifras .fact dt{font-size:0.72rem;letter-spacing:0.06em;color:var(--aj-ink-soft);margin-bottom:0.2em;}
  .aj-articulo-wp dl.cifras .fact dd{margin:0;font-size:1.1rem;font-weight:700;color:var(--aj-ink);font-family:"Source Serif 4",serif;}
  .aj-articulo-wp .firma{margin-top:2em;padding-top:1.6em;border-top:1px solid var(--aj-rule);}
  .aj-articulo-wp .firma p{margin:0 0 4px;}
  .aj-articulo-wp .firma .firma-nombre{font-family:"Source Serif 4",serif;font-style:italic;font-size:1.25rem;color:var(--aj-ink);}
  .aj-articulo-wp .firma .firma-cargo{font-family:"Inter",sans-serif;font-size:0.85rem;color:var(--aj-ink-soft);}
  .aj-articulo-wp .aj-pie{max-width:var(--aj-max);margin:2.6em auto 0;padding:26px 0 0;border-top:1px solid var(--aj-rule);font-family:"Inter",sans-serif;font-size:0.8rem;color:var(--aj-ink-soft);text-align:center;}
  .aj-articulo-wp .aj-pie .aj-fname{font-weight:700;letter-spacing:0.06em;color:var(--aj-ink);margin-bottom:6px;}
  .aj-articulo-wp .aj-pie .aj-fline{margin:2px 0;}
  .aj-articulo-wp .aj-pie a{color:var(--aj-ink-soft);text-decoration:underline;}
</style>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
`.trim();

export function construirHtmlWordpress(datos: {
  contenidoHtml: string;
  extracto?: string;
  areaPractica?: MateriaJuridica;
}): string {
  const kicker = datos.areaPractica ? ETIQUETAS_AREA_KICKER[datos.areaPractica] : 'JAYM Legal';

  const dek = datos.extracto
    ? `<p class="aj-dek">${escaparHtml(datos.extracto)}</p>`
    : '';

  return [
    ESTILOS_WP,
    '<div class="aj-articulo-wp">',
    `<p class="aj-kicker">Análisis jurídico · ${escaparHtml(kicker)}</p>`,
    dek,
    '<div class="aj-rule-fina" aria-hidden="true"></div>',
    datos.contenidoHtml,
    '<div class="aj-pie">',
    `<p class="aj-fname">${escaparHtml(MARCA_CORPORATIVA.razonSocial)}</p>`,
    `<p class="aj-fline">RNC ${escaparHtml(MARCA_CORPORATIVA.rnc)}</p>`,
    `<p class="aj-fline">${escaparHtml(MARCA_CORPORATIVA.direccion)}</p>`,
    `<p class="aj-fline">Tel. ${escaparHtml(MARCA_CORPORATIVA.telefono)} · <a href="mailto:${MARCA_CORPORATIVA.correos[1]}">${MARCA_CORPORATIVA.correos[1]}</a></p>`,
    `<p class="aj-fline"><a href="${MARCA_CORPORATIVA.web}" target="_blank" rel="noopener">jaymlegalmultiservices.com</a></p>`,
    '</div>',
    '</div>',
  ].join('\n');
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
