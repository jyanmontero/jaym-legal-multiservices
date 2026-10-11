import { describe, it, expect } from 'vitest';
import { limpiarHtmlArticulo, construirHtmlWordpress } from './plantilla-articulo-blog.js';

describe('limpiarHtmlArticulo', () => {
  it('cambia los espacios no separables por espacios normales', () => {
    const sucio = '<p>La Ley&nbsp;74-25&#160;entró</p>';
    expect(limpiarHtmlArticulo(sucio)).toBe('<p>La Ley 74-25 entró</p>');
  });

  it('quita párrafos vacíos pero conserva los que tienen texto', () => {
    const sucio = '<p>Uno</p><p><br></p><p></p><p> </p><p>Dos</p>';
    expect(limpiarHtmlArticulo(sucio)).toBe('<p>Uno</p><p>Dos</p>');
  });

  it('se aplica al HTML que va a WordPress', () => {
    const html = construirHtmlWordpress({ contenidoHtml: '<p>a b</p><p><br></p>' });
    expect(html).toContain('<p>a b</p>');
    expect(html).not.toContain(' ');
  });
});
