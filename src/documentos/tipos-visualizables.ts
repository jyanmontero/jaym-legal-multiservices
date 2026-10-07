import { extname } from 'path';

/**
 * Tipos que el visor de la plataforma puede mostrar "en línea" sin
 * descargar. Lista cerrada a propósito: nada de SVG ni HTML (podrían
 * ejecutar scripts dentro del origen de la aplicación). Word/Excel y
 * demás formatos de oficina solo se descargan.
 */
const POR_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
};

/** Devuelve el Content-Type seguro para mostrar en línea, o null si solo se puede descargar. */
export function tipoVisualizable(nombreArchivo: string, tipoMime?: string): string | null {
  const porExt = POR_EXTENSION[extname(nombreArchivo).toLowerCase()];
  if (!porExt) return null;
  // Si el navegador declaró un MIME concreto, debe coincidir con la extensión
  // (octet-stream es el comodín habitual y se acepta).
  const base = porExt.split(';')[0];
  const declarado = (tipoMime ?? '').split(';')[0].trim().toLowerCase();
  if (declarado && declarado !== 'application/octet-stream' && declarado !== base) return null;
  return porExt;
}
