import { newCell, newRow, type Cell, type ImageFormat, type Project, type Row, type SliceRef } from './model';

export const MIN_SIZE = 8; // px mínimos de uma fatia na imagem original

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Encontra a linha que contém a coordenada y. */
export function rowAt(rows: Row[], y: number): number {
  return rows.findIndex((r) => y >= r.y && y < r.y + r.height);
}

/** Encontra a célula de uma linha que contém a coordenada x. */
export function cellAt(row: Row, x: number): number {
  return row.cells.findIndex((c) => x >= c.x && x < c.x + c.width);
}

/**
 * Divide a linha que contém y em duas, no ponto y.
 * A linha de cima mantém as células; a de baixo nasce com uma célula única.
 */
export function splitRow(project: Project, y: number): Project {
  const p = clone(project);
  const i = rowAt(p.rows, y);
  if (i < 0) return project;
  const row = p.rows[i]!;
  const top = y - row.y;
  const bottom = row.y + row.height - y;
  if (top < MIN_SIZE || bottom < MIN_SIZE) return project;
  const below = newRow(y, bottom, p.source.width);
  // a linha de baixo herda o formato da primeira célula de cima
  below.cells[0]!.format = row.cells[0]!.format;
  row.height = top;
  p.rows.splice(i + 1, 0, below);
  return p;
}

/** Divide a célula que contém x, dentro da linha rowIndex, no ponto x. */
export function splitCell(project: Project, rowIndex: number, x: number): Project {
  const p = clone(project);
  const row = p.rows[rowIndex];
  if (!row) return project;
  const ci = cellAt(row, x);
  if (ci < 0) return project;
  const cell = row.cells[ci]!;
  const left = x - cell.x;
  const right = cell.x + cell.width - x;
  if (left < MIN_SIZE || right < MIN_SIZE) return project;
  const rightCell = newCell(x, right, cell.format);
  cell.width = left;
  row.cells.splice(ci + 1, 0, rightCell);
  return p;
}

/**
 * Move a fronteira entre as linhas i e i+1 para newY.
 * Respeita o tamanho mínimo de cada lado.
 */
export function moveRowBoundary(project: Project, i: number, newY: number): Project {
  const p = clone(project);
  const a = p.rows[i];
  const b = p.rows[i + 1];
  if (!a || !b) return project;
  const min = a.y + MIN_SIZE;
  const max = b.y + b.height - MIN_SIZE;
  const y = Math.round(Math.max(min, Math.min(max, newY)));
  a.height = y - a.y;
  b.height = b.y + b.height - y;
  b.y = y;
  return p;
}

/** Move a fronteira entre as células j e j+1 da linha rowIndex para newX. */
export function moveCellBoundary(project: Project, rowIndex: number, j: number, newX: number): Project {
  const p = clone(project);
  const row = p.rows[rowIndex];
  if (!row) return project;
  const a = row.cells[j];
  const b = row.cells[j + 1];
  if (!a || !b) return project;
  const min = a.x + MIN_SIZE;
  const max = b.x + b.width - MIN_SIZE;
  const x = Math.round(Math.max(min, Math.min(max, newX)));
  a.width = x - a.x;
  b.width = b.x + b.width - x;
  b.x = x;
  return p;
}

/** Remove a fronteira entre as linhas i e i+1: a linha de cima absorve a de baixo e vira célula única. */
export function mergeRows(project: Project, i: number): Project {
  const p = clone(project);
  const a = p.rows[i];
  const b = p.rows[i + 1];
  if (!a || !b) return project;
  const first = a.cells[0]!;
  a.height += b.height;
  a.cells = [{ ...first, x: 0, width: p.source.width }];
  p.rows.splice(i + 1, 1);
  return p;
}

/** Remove a fronteira entre as células j e j+1: a da esquerda absorve a da direita. */
export function mergeCells(project: Project, rowIndex: number, j: number): Project {
  const p = clone(project);
  const row = p.rows[rowIndex];
  if (!row) return project;
  const a = row.cells[j];
  const b = row.cells[j + 1];
  if (!a || !b) return project;
  a.width += b.width;
  row.cells.splice(j + 1, 1);
  return p;
}

export function updateCell(project: Project, cellId: string, patch: Partial<Pick<Cell, 'href' | 'alt' | 'format'>>): Project {
  const p = clone(project);
  for (const row of p.rows) {
    const c = row.cells.find((x) => x.id === cellId);
    if (c) {
      Object.assign(c, patch);
      return p;
    }
  }
  return project;
}

export function findCell(project: Project, cellId: string): { row: Row; cell: Cell; rowIndex: number; colIndex: number } | null {
  for (let ri = 0; ri < project.rows.length; ri++) {
    const row = project.rows[ri]!;
    for (let ci = 0; ci < row.cells.length; ci++) {
      const cell = row.cells[ci]!;
      if (cell.id === cellId) return { row, cell, rowIndex: ri, colIndex: ci };
    }
  }
  return null;
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

export function sliceFilename(rowIndex: number, colIndex: number, cellCount: number, format: ImageFormat): string {
  const n = String(rowIndex + 1).padStart(2, '0');
  const ext = format === 'jpeg' ? 'jpg' : 'png';
  if (cellCount === 1) return `${n}.${ext}`;
  return `${n}-${LETTERS[colIndex] ?? String(colIndex)}.${ext}`;
}

/** Lista todas as fatias a recortar, na ordem de leitura. */
export function slices(project: Project): SliceRef[] {
  const out: SliceRef[] = [];
  project.rows.forEach((row, ri) => {
    row.cells.forEach((cell, ci) => {
      out.push({
        cellId: cell.id,
        rowIndex: ri,
        colIndex: ci,
        filename: sliceFilename(ri, ci, row.cells.length, cell.format),
        format: cell.format,
        x: cell.x,
        y: row.y,
        width: cell.width,
        height: row.height,
      });
    });
  });
  return out;
}

/**
 * Converte px da imagem original em px de exibição, garantindo que as
 * larguras das colunas de uma linha somem exatamente displayWidth
 * (escala as fronteiras, não as larguras, para evitar erros de arredondamento).
 */
export function displayColumns(row: Row, sourceWidth: number, displayWidth: number): number[] {
  const scale = displayWidth / sourceWidth;
  const bounds = row.cells.map((c) => Math.round((c.x + c.width) * scale));
  bounds[bounds.length - 1] = displayWidth;
  const widths: number[] = [];
  let prev = 0;
  for (const b of bounds) {
    widths.push(b - prev);
    prev = b;
  }
  return widths;
}

export function displayHeight(row: Row, sourceWidth: number, displayWidth: number): number {
  return Math.max(1, Math.round(row.height * (displayWidth / sourceWidth)));
}

/** Confere se as linhas cobrem a imagem inteira sem buracos e as células cobrem cada linha. */
export function validateProject(project: Project): string[] {
  const errors: string[] = [];
  let y = 0;
  project.rows.forEach((row, ri) => {
    if (row.y !== y) errors.push(`Linha ${ri + 1} começa em ${row.y}, esperado ${y}.`);
    if (row.height < MIN_SIZE) errors.push(`Linha ${ri + 1} tem altura menor que ${MIN_SIZE}px.`);
    y = row.y + row.height;
    let x = 0;
    row.cells.forEach((cell, ci) => {
      if (cell.x !== x) errors.push(`Célula ${ri + 1}/${ci + 1} começa em ${cell.x}, esperado ${x}.`);
      if (cell.width < MIN_SIZE) errors.push(`Célula ${ri + 1}/${ci + 1} tem largura menor que ${MIN_SIZE}px.`);
      x = cell.x + cell.width;
    });
    if (x !== project.source.width) errors.push(`Linha ${ri + 1} não cobre a largura da imagem.`);
  });
  if (y !== project.source.height) errors.push('As linhas não cobrem a altura da imagem.');
  return errors;
}
