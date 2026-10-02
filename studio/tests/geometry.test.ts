import { describe, expect, it } from 'vitest';
import {
  displayColumns,
  mergeCells,
  mergeRows,
  moveCellBoundary,
  moveRowBoundary,
  sliceFilename,
  slices,
  splitCell,
  splitRow,
  validateProject,
} from '../src/shared/geometry';
import { newProject } from '../src/shared/model';

const base = () => newProject('Teste', '2026-10-teste', { width: 1200, height: 900, filename: 'a.png' });

describe('splitRow / mergeRows', () => {
  it('divide e mantém cobertura', () => {
    let p = splitRow(base(), 300);
    expect(p.rows.map((r) => [r.y, r.height])).toEqual([
      [0, 300],
      [300, 600],
    ]);
    p = splitRow(p, 500);
    expect(p.rows.map((r) => [r.y, r.height])).toEqual([
      [0, 300],
      [300, 200],
      [500, 400],
    ]);
    expect(validateProject(p)).toEqual([]);
    p = mergeRows(p, 0);
    expect(p.rows.map((r) => [r.y, r.height])).toEqual([
      [0, 500],
      [500, 400],
    ]);
    expect(validateProject(p)).toEqual([]);
  });
  it('ignora cortes muito perto da borda', () => {
    const p = base();
    expect(splitRow(p, 2)).toBe(p);
    expect(splitRow(p, 897)).toBe(p);
  });
  it('move fronteira com limites', () => {
    let p = splitRow(base(), 300);
    p = moveRowBoundary(p, 0, 450);
    expect(p.rows.map((r) => [r.y, r.height])).toEqual([
      [0, 450],
      [450, 450],
    ]);
    p = moveRowBoundary(p, 0, -50);
    expect(p.rows[0]!.height).toBe(8);
    expect(validateProject(p)).toEqual([]);
  });
});

describe('splitCell / mergeCells', () => {
  it('divide colunas', () => {
    let p = splitCell(base(), 0, 600);
    expect(p.rows[0]!.cells.map((c) => [c.x, c.width])).toEqual([
      [0, 600],
      [600, 600],
    ]);
    p = splitCell(p, 0, 900);
    expect(p.rows[0]!.cells.map((c) => [c.x, c.width])).toEqual([
      [0, 600],
      [600, 300],
      [900, 300],
    ]);
    expect(validateProject(p)).toEqual([]);
    p = moveCellBoundary(p, 0, 0, 500);
    expect(p.rows[0]!.cells.map((c) => [c.x, c.width])).toEqual([
      [0, 500],
      [500, 400],
      [900, 300],
    ]);
    p = mergeCells(p, 0, 1);
    expect(p.rows[0]!.cells.map((c) => [c.x, c.width])).toEqual([
      [0, 500],
      [500, 700],
    ]);
    expect(validateProject(p)).toEqual([]);
  });
  it('mergeRows volta para célula única', () => {
    let p = splitRow(base(), 300);
    p = splitCell(p, 1, 600);
    p = mergeRows(p, 0);
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0]!.cells).toHaveLength(1);
    expect(p.rows[0]!.cells[0]!.width).toBe(1200);
  });
});

describe('slices e nomes', () => {
  it('nomeia por linha e coluna', () => {
    expect(sliceFilename(0, 0, 1, 'jpeg')).toBe('01.jpg');
    expect(sliceFilename(1, 1, 3, 'png')).toBe('02-b.png');
  });
  it('lista na ordem de leitura', () => {
    let p = splitRow(base(), 300);
    p = splitCell(p, 1, 600);
    const s = slices(p);
    expect(s.map((x) => x.filename)).toEqual(['01.jpg', '02-a.jpg', '02-b.jpg']);
    expect(s[2]).toMatchObject({ x: 600, y: 300, width: 600, height: 600 });
  });
});

describe('displayColumns', () => {
  it('soma exatamente a largura de exibição', () => {
    let p = splitCell(base(), 0, 401);
    p = splitCell(p, 0, 802);
    const w = displayColumns(p.rows[0]!, 1200, 600);
    expect(w.reduce((a, b) => a + b, 0)).toBe(600);
    expect(w).toEqual([201, 200, 199]);
  });
});
