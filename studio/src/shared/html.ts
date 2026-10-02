import { displayColumns, displayHeight, slices } from './geometry';
import type { Project } from './model';

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

export function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;');
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
    `<!--[if mso]></td></tr></table><![endif]-->`,
    `</td></tr>`,
    `</table>`,
  ].join('\n');

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
