export interface ResultadoPublicador {
  idExterno?: string;
  enlace?: string;
}

export const pausa = (ms: number): Promise<void> => new Promise((resolver) => setTimeout(resolver, ms));
