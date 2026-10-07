/**
 * Formato único de dinero: coma para los miles y punto para los decimales,
 * siempre con dos decimales (1,000,000.00). Se fija 'en-US' para que no
 * dependa de los datos de idioma del servidor.
 */
export function formatearMonto(valor: number | string | null | undefined): string {
  const n = typeof valor === 'string' ? Number(valor.replace(/,/g, '')) : Number(valor ?? 0);
  return (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatearRD(valor: number | string | null | undefined): string {
  return `RD$ ${formatearMonto(valor)}`;
}
