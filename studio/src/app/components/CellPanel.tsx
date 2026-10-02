import { displayColumns, displayHeight, sliceFilename } from '../../shared/geometry';
import type { Cell, Project, Row } from '../../shared/model';

interface Props {
  info: { row: Row; cell: Cell; rowIndex: number; colIndex: number } | null;
  project: Project;
  onChange: (cellId: string, patch: Partial<Pick<Cell, 'href' | 'alt' | 'format'>>) => void;
  onSelectTool: () => void;
}

export function CellPanel({ info, project, onChange, onSelectTool }: Props) {
  if (!info) {
    return (
      <div class="card">
        <div class="text-sm font-semibold">Célula</div>
        <p class="mt-1 text-sm text-ink-3">
          Nenhuma selecionada.{' '}
          <button class="text-accent underline" onClick={onSelectTool}>
            Use a ferramenta Selecionar
          </button>{' '}
          e clique numa fatia.
        </p>
      </div>
    );
  }
  const { row, cell, rowIndex, colIndex } = info;
  const w = displayColumns(row, project.source.width, project.displayWidth)[colIndex];
  const h = displayHeight(row, project.source.width, project.displayWidth);
  const name = sliceFilename(rowIndex, colIndex, row.cells.length, cell.format);
  const hrefOk = !cell.href.trim() || /^(https?:\/\/|mailto:|tel:)/i.test(cell.href.trim());

  return (
    <div class="card space-y-3">
      <div class="flex items-baseline justify-between">
        <div class="text-sm font-semibold">Célula {name}</div>
        <div class="text-xs text-ink-3">{w}×{h}px no email</div>
      </div>
      <div>
        <label class="label" for="href">Link (opcional)</label>
        <input
          id="href"
          class={`input ${hrefOk ? '' : 'border-danger'}`}
          placeholder="https://…"
          value={cell.href}
          onInput={(e) => onChange(cell.id, { href: (e.target as HTMLInputElement).value })}
        />
        {!hrefOk && <p class="mt-1 text-xs text-danger">Comece com https://, mailto: ou tel:.</p>}
      </div>
      <div>
        <label class="label" for="alt">Texto alternativo</label>
        <input
          id="alt"
          class="input"
          placeholder="O que esta parte mostra"
          value={cell.alt}
          onInput={(e) => onChange(cell.id, { alt: (e.target as HTMLInputElement).value })}
        />
      </div>
      <div>
        <span class="label">Formato</span>
        <div class="flex gap-2">
          {(['jpeg', 'png'] as const).map((f) => (
            <label class={`flex-1 cursor-pointer rounded-md border px-3 py-2 text-center text-sm ${cell.format === f ? 'border-accent bg-accent/10 text-accent' : 'border-line'}`}>
              <input type="radio" class="sr-only" name="format" checked={cell.format === f} onChange={() => onChange(cell.id, { format: f })} />
              {f === 'jpeg' ? 'JPEG (fotos)' : 'PNG (texto, logo)'}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
