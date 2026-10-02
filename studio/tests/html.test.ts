import { describe, expect, it } from 'vitest';
import { splitCell, splitRow, updateCell } from '../src/shared/geometry';
import { checkLimits, generateEmailHtml } from '../src/shared/html';
import { newProject } from '../src/shared/model';

function sample() {
  let p = newProject('Civic & Cia', '2026-10-civic', { width: 1200, height: 900, filename: 'a.png' });
  p = splitRow(p, 600);
  p = splitCell(p, 1, 600);
  const [r0, r1] = p.rows;
  p = updateCell(p, r0!.cells[0]!.id, { href: 'https://honda.com.br/civic?utm=1', alt: 'Novo Civic' });
  p = updateCell(p, r1!.cells[0]!.id, { href: 'https://wa.me/55', alt: 'WhatsApp', format: 'png' });
  p = updateCell(p, r1!.cells[1]!.id, { alt: 'Rodapé' });
  p.preheader = 'Condições <especiais>';
  return p;
}

describe('generateEmailHtml', () => {
  const { document, fragment } = generateEmailHtml(sample(), 'https://cdn.katiasantos.com/c/2026-10-civic/');

  it('usa URLs do CDN e dimensões de exibição', () => {
    expect(fragment).toContain('src="https://cdn.katiasantos.com/c/2026-10-civic/01.jpg" width="600" height="300"');
    expect(fragment).toContain('src="https://cdn.katiasantos.com/c/2026-10-civic/02-a.png" width="300" height="150"');
    expect(fragment).toContain('src="https://cdn.katiasantos.com/c/2026-10-civic/02-b.jpg" width="300" height="150"');
  });
  it('envolve com link só quando há href', () => {
    expect(fragment).toContain('<a href="https://honda.com.br/civic?utm=1" target="_blank"');
    expect(fragment).toContain('<a href="https://wa.me/55"');
    expect(fragment.match(/<a /g)).toHaveLength(2);
  });
  it('escapa texto', () => {
    expect(document).toContain('<title>Civic &amp; Cia</title>');
    expect(document).toContain('Condições &lt;especiais&gt;');
  });
  it('tem tabela aninhada para colunas e ghost table do Outlook', () => {
    expect(fragment).toContain('<td width="300"');
    expect(fragment).toContain('<!--[if mso]><table role="presentation" width="600"');
    expect(document.startsWith('<!DOCTYPE html PUBLIC')).toBe(true);
  });
});

describe('checkLimits', () => {
  it('avisa sobre alt vazio e fatia pesada', () => {
    const p = sample();
    const { document } = generateEmailHtml(p, 'https://cdn.katiasantos.com/c/x');
    const sizes = new Map([['01.jpg', 400 * 1024]]);
    const w = checkLimits(p, document, sizes);
    expect(w.some((x) => x.message.includes('01.jpg'))).toBe(true);
    expect(w.some((x) => x.message.includes('texto alternativo'))).toBe(false);
  });
  it('avisa sobre fatia muito alta', () => {
    const p = newProject('x', 'x', { width: 600, height: 4000, filename: 'a.png' });
    const w = checkLimits(p, '', null);
    expect(w.some((x) => x.message.includes('1700px'))).toBe(true);
  });
});

describe('pacote com caminhos relativos', () => {
  it('aceita pasta relativa', () => {
    const { document } = generateEmailHtml(sample(), 'imagens');
    expect(document).toContain('src="imagens/01.jpg"');
    expect(document).toContain('src="imagens/02-a.png"');
    expect(document).not.toContain('cdn.katiasantos.com');
  });
});
