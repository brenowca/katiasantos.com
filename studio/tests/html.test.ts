import { describe, expect, it } from 'vitest';
import { splitCell, splitRow, updateCell } from '../src/shared/geometry';
import { checkLimits, generateEmailHtml, generateMyHondaFragment, generateMyHondaImageMap } from '../src/shared/html';
import { fullImageFilename, newProject } from '../src/shared/model';

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
  it('inclui o rodapé padrão e permite removê-lo', () => {
    expect(document).toContain('Desacelere, seu bem maior é a vida.');
    expect(document).toContain('solicite o descadastramento');
    const semRodape = { ...sample(), footerLines: [] };
    expect(generateEmailHtml(semRodape, 'https://x').document).not.toContain('Desacelere');
    const legado = { ...sample(), footerLines: undefined };
    expect(generateEmailHtml(legado, 'https://x').document).not.toContain('Desacelere');
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

describe('generateMyHondaFragment', () => {
  const frag = generateMyHondaFragment(sample(), 'https://cdn.mktassets.com/c/2026-10-civic');
  it('é só um fragmento, sem documento', () => {
    expect(frag.startsWith('<div ')).toBe(true);
    expect(frag).not.toMatch(/<!DOCTYPE|<html|<head|<body|<style|\[if mso\]/);
  });
  it('campanha antiga sem campo recebe o rodapé padrão no fragmento', () => {
    const legado = { ...sample(), footerLines: undefined };
    expect(generateMyHondaFragment(legado, 'https://x')).toContain('Desacelere');
  });
  it('tem as imagens, o rodapé obrigatório e a tag de rastreamento', () => {
    expect(frag.match(/<img /g)).toHaveLength(3);
    expect(frag).toContain('src="https://cdn.mktassets.com/c/2026-10-civic/01.jpg"');
    expect(frag).toContain('Desacelere, seu bem maior é a vida.');
    expect(frag).toContain('solicite o descadastramento');
    expect(frag).toContain('<custom name="opencounter" type="tracking" />');
  });
});

describe('generateMyHondaImageMap', () => {
  const p = { ...sample(), publishedAt: '2026-10-15T12:00:00.000Z' };
  const frag = generateMyHondaImageMap(p, 'https://cdn.mktassets.com/c/2026-10-civic/', 'full.jpg');
  it('tem uma única imagem com usemap e o mapa', () => {
    expect(frag.match(/<img /g)).toHaveLength(1);
    expect(frag).toContain('src="https://cdn.mktassets.com/c/2026-10-civic/full.jpg?_t=1792065600" alt="Civic &amp; Cia" usemap="#image-map"');
    expect(frag).toContain('<map name="image-map">');
  });
  it('gera uma área por célula com link, em pixels de exibição', () => {
    expect(frag.match(/<area /g)).toHaveLength(2);
    expect(frag).toContain('href="https://honda.com.br/civic?utm=1" coords="0,0,600,300" shape="rect"');
    expect(frag).toContain('alt="WhatsApp" title="WhatsApp" href="https://wa.me/55" coords="0,300,300,450" shape="rect"');
  });
  it('é só um fragmento, com rodapé e rastreamento', () => {
    expect(frag.startsWith('<div ')).toBe(true);
    expect(frag).not.toMatch(/<!DOCTYPE|<html|<head|<body|<style|<table[^>]*role=/);
    expect(frag).toContain('width="600px" border="0" align="Left"');
    expect(frag).toContain('Desacelere, seu bem maior é a vida.');
    expect(frag).toContain('"Caso prefira não receber');
    expect(frag).toContain('<custom name="opencounter" type="tracking" />');
  });
  it('escolhe PNG só quando todas as fatias são PNG', () => {
    expect(fullImageFilename(sample())).toBe('full.jpg');
    const png = newProject('x', 'x', { width: 600, height: 100, filename: 'a.png' });
    png.rows[0]!.cells[0]!.format = 'png';
    expect(fullImageFilename(png)).toBe('full.png');
  });
});
