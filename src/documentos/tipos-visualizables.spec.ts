import { describe, it, expect } from 'vitest';
import { tipoVisualizable } from './tipos-visualizables.js';

describe('tipoVisualizable', () => {
  it('permite PDF, imágenes y texto', () => {
    expect(tipoVisualizable('a.pdf', 'application/pdf')).toBe('application/pdf');
    expect(tipoVisualizable('a.JPG', 'image/jpeg')).toBe('image/jpeg');
    expect(tipoVisualizable('a.txt', 'text/plain')).toContain('text/plain');
  });
  it('acepta octet-stream si la extensión es segura', () => {
    expect(tipoVisualizable('a.pdf', 'application/octet-stream')).toBe('application/pdf');
  });
  it('rechaza SVG, HTML, Office y MIME que no coincide', () => {
    expect(tipoVisualizable('a.svg', 'image/svg+xml')).toBeNull();
    expect(tipoVisualizable('a.html', 'text/html')).toBeNull();
    expect(tipoVisualizable('a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBeNull();
    expect(tipoVisualizable('a.pdf', 'text/html')).toBeNull();
  });
});
