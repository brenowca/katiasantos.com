import { displayColumns, displayHeight, slices } from './geometry';
import { DEFAULT_FOOTER_LINES, type Project } from './model';

export interface EmailHtml {
  /** Documento completo (doctype, head, body). Para colar na plataforma de disparo ou baixar. */
  document: string;
  /** Só a tabela do email. Para colar como conteúdo rico no Gmail. */
  fragment: string;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Para texto entre tags: aspas ficam literais, como na campanha aprovada. */
export function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

const FOOTER_TD_STYLE =
  'text-align:center;font-style:normal;font-weight:300;font-size:11px;line-height:16px;color:#000000;font-family:Gotham,Helvetica Neue,Helvetica,Arial,sans-serif;';

/** Tabela de rodapé com um parágrafo por linha. Vazio = sem rodapé. */
export function footerTable(lines: readonly string[] | undefined, width: number): string {
  const rows = (lines ?? []).map((t) => t.trim()).filter(Boolean);
  if (!rows.length) return '';
  const trs = rows.map((t) => `<tr><td bgcolor="#f8f5f5" style="${FOOTER_TD_STYLE}">${escapeHtml(t)}</td></tr>`).join('\n');
  return `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="5" bgcolor="#f8f5f5" align="center" style="width:100%;max-width:${width}px;margin:0 auto;background-color:#f8f5f5;">\n${trs}\n</table>`;
}

const IMG_STYLE = 'display:block;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;';

function img(src: string, w: number, h: number, alt: string): string {
  return `<img src="${escapeAttr(src)}" width="${w}" height="${h}" alt="${escapeAttr(alt)}" style="${IMG_STYLE}width:100%;max-width:${w}px;height:auto;" />`;
}

function linked(href: string, inner: string): string {
  if (!href.trim()) return inner;
  return `<a href="${escapeAttr(href.trim())}" target="_blank" style="display:block;text-decoration:none;">${inner}</a>`;
}

/**
 * Gera o HTML do email fatiado.
 * @param project  projeto com linhas, colunas e links
 * @param folderUrl URL pública da pasta da campanha, sem barra final (ex.: https://cdn.katiasantos.com/c/2026-10-civic)
 */
export function generateEmailHtml(project: Project, folderUrl: string): EmailHtml {
  const W = project.displayWidth;
  const base = folderUrl.replace(/\/+$/, '');
  const refs = slices(project);
  const byCell = new Map(refs.map((r) => [r.cellId, r]));

  const rowsHtml = project.rows
    .map((row) => {
      const h = displayHeight(row, project.source.width, W);
      if (row.cells.length === 1) {
        const cell = row.cells[0]!;
        const ref = byCell.get(cell.id)!;
        return `<tr><td style="padding:0;">${linked(cell.href, img(`${base}/${ref.filename}`, W, h, cell.alt))}</td></tr>`;
      }
      const widths = displayColumns(row, project.source.width, W);
      const tds = row.cells
        .map((cell, i) => {
          const ref = byCell.get(cell.id)!;
          const w = widths[i]!;
          return `<td width="${w}" valign="top" style="padding:0;width:${w}px;">${linked(cell.href, img(`${base}/${ref.filename}`, w, h, cell.alt))}</td>`;
        })
        .join('');
      return `<tr><td style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>${tds}</tr></table></td></tr>`;
    })
    .join('\n');

  const bg = project.backgroundColor || '#ffffff';

  const fragment = [
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${escapeAttr(bg)}" style="border-collapse:collapse;background-color:${escapeAttr(bg)};">`,
    `<tr><td align="center" style="padding:0;">`,
    `<!--[if mso]><table role="presentation" width="${W}" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:collapse;width:100%;max-width:${W}px;margin:0 auto;">`,
    rowsHtml,
    `</table>`,
    footerTable(project.footerLines, W),
    `<!--[if mso]></td></tr></table><![endif]-->`,
    `</td></tr>`,
    `</table>`,
  ]
    .filter(Boolean)
    .join('\n');

  const preheader = project.preheader.trim()
    ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(project.preheader.trim())}</div>\n`
    : '';

  const document = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="pt-BR">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
<title>${escapeHtml(project.name)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style type="text/css">
body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}
img{border:0;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;display:block;}
a{text-decoration:none;}
</style>
</head>
<body style="margin:0;padding:0;background-color:${escapeAttr(bg)};">
${preheader}${fragment}
</body>
</html>
`;

  return { document, fragment };
}

export const LIMITS = {
  /** Gmail corta emails com HTML maior que ~102 KB. */
  htmlBytes: 102 * 1024,
  /** Outlook tem problemas com imagens mais altas que ~1728px. */
  sliceHeightPx: 1700,
  /** Fatia acima disso pesa no carregamento e na reputação. */
  sliceBytes: 300 * 1024,
  /** Peso total razoável das imagens. */
  totalImageBytes: 1500 * 1024,
};

export interface Warning {
  level: 'warn' | 'error';
  message: string;
}

export function checkLimits(project: Project, html: string, sliceSizes: Map<string, number> | null): Warning[] {
  const out: Warning[] = [];
  const htmlBytes = new TextEncoder().encode(html).length;
  if (htmlBytes > LIMITS.htmlBytes) {
    out.push({ level: 'error', message: `O HTML tem ${Math.round(htmlBytes / 1024)} KB; o Gmail corta acima de 102 KB.` });
  }
  const refs = slices(project);
  for (const r of refs) {
    const dispH = Math.round(r.height * (project.displayWidth / project.source.width));
    if (dispH > LIMITS.sliceHeightPx) {
      out.push({ level: 'warn', message: `A fatia ${r.filename} tem ${dispH}px de altura; acima de 1700px o Outlook pode cortar. Divida a linha.` });
    }
    const size = sliceSizes?.get(r.filename);
    if (size !== undefined && size > LIMITS.sliceBytes) {
      out.push({ level: 'warn', message: `A fatia ${r.filename} pesa ${Math.round(size / 1024)} KB; tente JPEG ou reduza a qualidade.` });
    }
  }
  if (sliceSizes) {
    let total = 0;
    for (const v of sliceSizes.values()) total += v;
    if (total > LIMITS.totalImageBytes) {
      out.push({ level: 'warn', message: `As imagens somam ${Math.round(total / 1024)} KB; acima de 1,5 MB o email demora a abrir no celular.` });
    }
  }
  const empty = refs.filter((r) => {
    const c = project.rows[r.rowIndex]!.cells[r.colIndex]!;
    return !c.alt.trim();
  });
  if (empty.length) {
    out.push({ level: 'warn', message: `${empty.length} fatia(s) sem texto alternativo. Quem abre com imagens bloqueadas não verá nada.` });
  }
  return out;
}


/**
 * Fragmento para colar no editor da plataforma myHonda, no mesmo molde de uma
 * campanha aprovada: só uma div com o conteúdo, sem doctype, head, body, style
 * nem comentários condicionais. Inclui o rodapé obrigatório e a tag de
 * rastreamento de abertura da plataforma.
 */
export function generateMyHondaFragment(project: Project, folderUrl: string): string {
  const W = project.displayWidth;
  const base = folderUrl.replace(/\/+$/, '');
  const refs = slices(project);
  const byCell = new Map(refs.map((r) => [r.cellId, r]));

  const rows = project.rows
    .map((row) => {
      const h = displayHeight(row, project.source.width, W);
      if (row.cells.length === 1) {
        const cell = row.cells[0]!;
        const ref = byCell.get(cell.id)!;
        return `<tr><td style="padding:0;">${linked(cell.href, img(`${base}/${ref.filename}`, W, h, cell.alt))}</td></tr>`;
      }
      const widths = displayColumns(row, project.source.width, W);
      const tds = row.cells
        .map((cell, i) => {
          const ref = byCell.get(cell.id)!;
          const w = widths[i]!;
          return `<td width="${w}" valign="top" style="padding:0;width:${w}px;">${linked(cell.href, img(`${base}/${ref.filename}`, w, h, cell.alt))}</td>`;
        })
        .join('');
      return `<tr><td style="padding:0;"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>${tds}</tr></table></td></tr>`;
    })
    .join('\n');

  const footer = footerTable(project.footerLines ?? DEFAULT_FOOTER_LINES, W);

  return [
    `<div style="width:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;">`,
    `<table width="${W}" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:${W}px;max-width:${W}px;">`,
    rows,
    `</table>`,
    footer ? `<br />` : '',
    footer,
    `<custom name="opencounter" type="tracking" />`,
    `</div>`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Rodapé no molde exato da campanha aprovada (tabela de largura fixa, alinhada à esquerda). */
function myHondaFooterTable(lines: readonly string[] | undefined, width: number): string {
  const rows = (lines ?? []).map((t) => t.trim()).filter(Boolean);
  if (!rows.length) return '';
  const style =
    'text-align: center; font-style: normal; font-weight: 300; font-size: 11px; color: #000000; font-family: Gotham, Helvetica Neue, Helvetica, Arial, sans-serif;';
  const trs = rows.map((t) => `        <tr>\n            <td bgcolor="f8f5f5" style="${style}">\n                ${escapeText(t)}\n            </td>\n        </tr>`).join('\n');
  return `    <table width="${width}px" border="0" align="Left" cellpadding="0" cellspacing="5" bgcolor="#f8f5f5">\n${trs}\n    </table>`;
}

/**
 * Fragmento para o myHonda com UMA imagem (a arte inteira na largura de
 * exibição) e um mapa de links (<map>/<area>), no molde exato de uma campanha
 * aprovada de outra agência. Cada célula com link vira um retângulo clicável
 * em pixels de exibição; células sem link não geram área.
 * @param fullFilename nome da arte inteira na pasta (ex.: full.jpg)
 */
export function generateMyHondaImageMap(project: Project, folderUrl: string, fullFilename: string): string {
  const W = project.displayWidth;
  const base = folderUrl.replace(/\/+$/, '');
  const scale = W / project.source.width;
  const px = (v: number) => Math.round(v * scale);

  const areas: string[] = [];
  for (const row of project.rows) {
    const y1 = px(row.y);
    const y2 = px(row.y + row.height);
    for (const cell of row.cells) {
      const href = cell.href.trim();
      if (!href) continue;
      const x1 = px(cell.x);
      const x2 = px(cell.x + cell.width);
      const alt = escapeAttr(cell.alt.trim());
      areas.push(
        `    <area target="" alt="${alt}" title="${alt}" href="${escapeAttr(href)}" coords="${x1},${y1},${x2},${y2}" shape="rect">`,
      );
    }
  }

  const stamp = project.publishedAt ? Math.floor(new Date(project.publishedAt).getTime() / 1000) : Math.floor(Date.now() / 1000);
  const src = `${base}/${fullFilename}?_t=${stamp}`;
  const footer = myHondaFooterTable(project.footerLines ?? DEFAULT_FOOTER_LINES, W);

  return [
    `<div style="width: 100%; display: flex; align-items: center; justify-content: center; flex-direction: column">`,
    ``,
    `<!-- Image Map Generated by http://www.image-map.net/ -->`,
    `<img src="${escapeAttr(src)}" alt="${escapeAttr(project.name)}" usemap="#image-map">`,
    ``,
    `<map name="image-map">`,
    ...areas,
    `</map>`,
    `    <br />`,
    ``,
    footer,
    `    <custom name="opencounter" type="tracking" />`,
    `</div>`,
  ]
    .filter((l) => l !== null)
    .join('\n');
}
