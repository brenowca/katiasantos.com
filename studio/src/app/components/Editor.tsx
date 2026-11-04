import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  findCell,
  mergeCells,
  mergeRows,
  moveCellBoundary,
  moveRowBoundary,
  rowAt,
  sliceFilename,
  splitCell,
  splitRow,
  updateCell,
  validateProject,
} from '../../shared/geometry';
import { checkLimits, generateEmailHtml, type Warning } from '../../shared/html';
import type { Project, PublishResult } from '../../shared/model';
import { isValidSlug } from '../../shared/slug';
import { publish, slugExists } from '../api';
import { formatBytes, renderFull, sliceAll, type LoadedImage } from '../slicer';
import { CellPanel } from './CellPanel';
import { CampaignPanel } from './CampaignPanel';

type Tool = 'select' | 'row' | 'col';
type Drag = { type: 'row'; i: number } | { type: 'col'; rowIndex: number; j: number };

interface Props {
  initialProject: Project;
  image: LoadedImage;
  cdnBaseUrl: string;
  onCancel: () => void;
  onPublished: (project: Project, result: PublishResult, html: { document: string; fragment: string }) => void;
}

const ZOOMS = [
  { label: 'Ajustar', value: 'fit' },
  { label: '50%', value: '0.5' },
  { label: '75%', value: '0.75' },
  { label: '100%', value: '1' },
] as const;

export function Editor({ initialProject, image, cdnBaseUrl, onCancel, onPublished }: Props) {
  const [project, setProjectRaw] = useState(initialProject);
  const historyRef = useRef<{ past: Project[]; future: Project[] }>({ past: [], future: [] });
  const [tool, setTool] = useState<Tool>('row');
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string>('fit');
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [fitWidth, setFitWidth] = useState(800);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ html: string; warnings: Warning[]; total: number } | null>(null);
  const [showCampaign, setShowCampaign] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  /** Aplica uma mudança registrando no histórico (undo). */
  const commit = useCallback((next: Project | ((p: Project) => Project)) => {
    setProjectRaw((prev) => {
      const n = typeof next === 'function' ? next(prev) : next;
      if (n === prev) return prev;
      historyRef.current.past.push(prev);
      if (historyRef.current.past.length > 100) historyRef.current.past.shift();
      historyRef.current.future = [];
      return n;
    });
  }, []);

  /** Mudança transitória (arrasto): sem histórico. */
  const patch = useCallback((fn: (p: Project) => Project) => setProjectRaw((prev) => fn(prev)), []);

  const undo = useCallback(() => {
    setProjectRaw((prev) => {
      const h = historyRef.current;
      const p = h.past.pop();
      if (!p) return prev;
      h.future.push(prev);
      return p;
    });
  }, []);
  const redo = useCallback(() => {
    setProjectRaw((prev) => {
      const h = historyRef.current;
      const f = h.future.pop();
      if (!f) return prev;
      h.past.push(prev);
      return f;
    });
  }, []);

  // Largura disponível para o modo "Ajustar".
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setFitWidth(Math.max(200, entry.contentRect.width - 32));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = zoom === 'fit' ? Math.min(1, fitWidth / project.source.width) : Number(zoom);
  const stageW = project.source.width * scale;
  const stageH = project.source.height * scale;

  // Atalhos de teclado.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (e.key === 'Escape') setTool('select');
      if (e.key.toLowerCase() === 'h') setTool('row');
      if (e.key.toLowerCase() === 'v') setTool('col');
      if (e.key.toLowerCase() === 's') setTool('select');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  function toSource(e: PointerEvent | MouseEvent): { x: number; y: number } {
    const rect = stageRef.current!.getBoundingClientRect();
    const x = Math.round(Math.max(0, Math.min(project.source.width, (e.clientX - rect.left) / scale)));
    const y = Math.round(Math.max(0, Math.min(project.source.height, (e.clientY - rect.top) / scale)));
    return { x, y };
  }

  function onStageClick(e: MouseEvent) {
    if (drag) return;
    const { x, y } = toSource(e);
    if (tool === 'row') {
      commit((p) => splitRow(p, y));
    } else if (tool === 'col') {
      const ri = rowAt(project.rows, y);
      if (ri >= 0) commit((p) => splitCell(p, ri, x));
    }
  }

  function onStageMove(e: PointerEvent) {
    const pt = toSource(e);
    setHover(pt);
    if (!drag) return;
    if (drag.type === 'row') patch((p) => moveRowBoundary(p, drag.i, pt.y));
    else patch((p) => moveCellBoundary(p, drag.rowIndex, drag.j, pt.x));
  }

  function startDrag(d: Drag, e: PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    historyRef.current.past.push(project);
    historyRef.current.future = [];
    setDrag(d);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function endDrag() {
    if (drag) setDrag(null);
  }

  const selectedInfo = selected ? findCell(project, selected) : null;
  const errors = useMemo(() => validateProject(project), [project]);
  const folderUrl = `${cdnBaseUrl.replace(/\/+$/, '')}/c/${project.slug}`;

  async function buildPreview() {
    setError(null);
    setBusy(true);
    setStatus('Recortando fatias…');
    try {
      const blobs = await sliceAll(image, project, (d, t) => setStatus(`Recortando ${d}/${t}…`));
      const urls = new Map<string, string>();
      let total = 0;
      const sizes = new Map<string, number>();
      for (const [name, blob] of blobs) {
        urls.set(name, URL.createObjectURL(blob));
        sizes.set(name, blob.size);
        total += blob.size;
      }
      const { document: doc } = generateEmailHtml(project, folderUrl);
      let local = doc;
      for (const [name, url] of urls) local = local.split(`${folderUrl}/${name}`).join(url);
      setPreview({ html: local, warnings: checkLimits(project, doc, sizes), total });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  async function doPublish() {
    setError(null);
    if (errors.length) return setError(errors[0]!);
    if (!isValidSlug(project.slug)) return setError('Identificador inválido.');
    if (!cdnBaseUrl) return setError('CDN não configurado.');
    setBusy(true);
    try {
      setStatus('Conferindo nome…');
      if (await slugExists(project.slug)) {
        setError(`Já existe uma campanha "${project.slug}". Mude o identificador em "Campanha".`);
        return;
      }
      const blobs = await sliceAll(image, project, (d, t) => setStatus(`Recortando ${d}/${t}…`));
      setStatus('Gerando arte inteira…');
      const full = await renderFull(image, project);
      const html = generateEmailHtml(project, folderUrl);
      setStatus('Enviando…');
      const toSend = { ...project, fullImage: full.filename };
      const result = await publish(toSend, html.document, image.file, blobs, full, (f) => setStatus(`Enviando ${Math.round(f * 100)}%…`));
      onPublished(toSend, result, html);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  const cursor = tool === 'row' ? 'cursor-row-resize' : tool === 'col' ? 'cursor-col-resize' : 'cursor-default';

  return (
    <div class="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-4">
      {/* Barra de ferramentas */}
      <div class="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white px-3 py-2">
        <div class="flex items-center gap-1">
          <ToolButton active={tool === 'row'} onClick={() => setTool('row')} title="Cortar em linha (H)">
            ― Linha
          </ToolButton>
          <ToolButton active={tool === 'col'} onClick={() => setTool('col')} title="Dividir em colunas (V)">
            | Coluna
          </ToolButton>
          <ToolButton active={tool === 'select'} onClick={() => setTool('select')} title="Selecionar célula (S)">
            ▭ Selecionar
          </ToolButton>
        </div>
        <span class="mx-1 h-6 w-px bg-line" />
        <button class="btn-ghost" onClick={undo} title="Desfazer (⌘Z)">↶ Desfazer</button>
        <button class="btn-ghost" onClick={redo} title="Refazer (⇧⌘Z)">↷ Refazer</button>
        <span class="mx-1 h-6 w-px bg-line" />
        <select class="input w-auto py-1" value={zoom} onChange={(e) => setZoom((e.target as HTMLSelectElement).value)}>
          {ZOOMS.map((z) => (
            <option value={z.value}>{z.label}</option>
          ))}
        </select>
        <span class="text-xs text-ink-3">
          {project.source.width}×{project.source.height}px → exibe a {project.displayWidth}px
        </span>
        <div class="ml-auto flex items-center gap-2">
          <button class="btn-secondary" onClick={() => setShowCampaign((v) => !v)}>
            {showCampaign ? 'Fechar campanha' : 'Campanha'}
          </button>
          <button class="btn-secondary" onClick={buildPreview} disabled={busy}>
            Pré-visualizar
          </button>
          <button class="btn-primary" onClick={doPublish} disabled={busy || errors.length > 0}>
            {busy ? status ?? '…' : 'Publicar'}
          </button>
          <button class="btn-ghost" onClick={onCancel} disabled={busy}>Cancelar</button>
        </div>
      </div>

      {error && <div class="rounded-md border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger">{error}</div>}
      {errors.length > 0 && <div class="rounded-md border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger">{errors[0]}</div>}

      <div class="grid gap-3 lg:grid-cols-[1fr_320px]">
        {/* Área de edição */}
        <div ref={areaRef} class="overflow-auto rounded-lg border border-line bg-[#e9edf0] p-4" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          <div
            ref={stageRef}
            class={`relative mx-auto select-none shadow-md ${cursor}`}
            style={{ width: `${stageW}px`, height: `${stageH}px` }}
            onClick={onStageClick}
            onPointerMove={onStageMove}
            onPointerLeave={() => setHover(null)}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <img src={image.url} alt="" draggable={false} class="block h-full w-full" style={{ imageRendering: scale < 0.5 ? 'auto' : 'auto' }} />

            {/* Células */}
            {project.rows.map((row, ri) =>
              row.cells.map((cell, ci) => {
                const isSel = cell.id === selected;
                return (
                  <div
                    key={cell.id}
                    class={`absolute border transition-colors ${
                      isSel ? 'border-accent bg-accent/15 ring-2 ring-accent/60' : 'border-white/60 hover:bg-white/10'
                    }`}
                    style={{ left: cell.x * scale, top: row.y * scale, width: cell.width * scale, height: row.height * scale }}
                    onClick={(e) => {
                      if (tool === 'select') {
                        e.stopPropagation();
                        setSelected(cell.id);
                      }
                    }}
                  >
                    <span
                      class={`absolute left-1 top-1 rounded px-1.5 py-0.5 font-mono text-[10px] leading-none ${
                        cell.href ? 'bg-accent text-white' : 'bg-ink/80 text-white'
                      }`}
                    >
                      {sliceFilename(ri, ci, row.cells.length, cell.format)}
                      {cell.href ? ' ↗' : ''}
                    </span>
                  </div>
                );
              }),
            )}

            {/* Fronteiras entre linhas */}
            {project.rows.slice(1).map((row, idx) => (
              <div key={`rb-${row.id}`} class="absolute left-0 right-0 z-10" style={{ top: row.y * scale - 4, height: 8 }}>
                <div class="absolute left-0 right-0 top-[3px] h-0.5 bg-accent shadow-[0_0_0_1px_rgba(255,255,255,.8)]" />
                <div
                  class="absolute left-0 right-0 top-0 h-2 cursor-row-resize"
                  onPointerDown={(e) => startDrag({ type: 'row', i: idx }, e as unknown as PointerEvent)}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  class="absolute -right-3 -top-2 z-20 h-5 w-5 rounded-full bg-white text-[11px] leading-5 text-danger shadow ring-1 ring-line hover:bg-red-50"
                  title="Remover este corte"
                  onClick={(e) => {
                    e.stopPropagation();
                    commit((p) => mergeRows(p, idx));
                  }}
                >
                  ×
                </button>
              </div>
            ))}

            {/* Fronteiras entre colunas */}
            {project.rows.map((row, ri) =>
              row.cells.slice(1).map((cell, j) => (
                <div
                  key={`cb-${cell.id}`}
                  class="absolute z-10"
                  style={{ left: cell.x * scale - 4, top: row.y * scale, width: 8, height: row.height * scale }}
                >
                  <div class="absolute bottom-0 left-[3px] top-0 w-0.5 bg-accent shadow-[0_0_0_1px_rgba(255,255,255,.8)]" />
                  <div
                    class="absolute bottom-0 left-0 top-0 w-2 cursor-col-resize"
                    onPointerDown={(e) => startDrag({ type: 'col', rowIndex: ri, j }, e as unknown as PointerEvent)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    class="absolute -left-1.5 -top-2 z-20 h-5 w-5 rounded-full bg-white text-[11px] leading-5 text-danger shadow ring-1 ring-line hover:bg-red-50"
                    title="Remover esta divisão"
                    onClick={(e) => {
                      e.stopPropagation();
                      commit((p) => mergeCells(p, ri, j));
                    }}
                  >
                    ×
                  </button>
                </div>
              )),
            )}

            {/* Guia que segue o mouse no modo de corte */}
            {hover && !drag && tool === 'row' && (
              <div class="pointer-events-none absolute left-0 right-0 h-px bg-accent/80" style={{ top: hover.y * scale }} />
            )}
            {hover && !drag && tool === 'col' && (() => {
              const ri = rowAt(project.rows, hover.y);
              const row = project.rows[ri];
              if (!row) return null;
              return (
                <div
                  class="pointer-events-none absolute w-px bg-accent/80"
                  style={{ left: hover.x * scale, top: row.y * scale, height: row.height * scale }}
                />
              );
            })()}
          </div>
          <p class="mt-3 text-center text-xs text-ink-3">
            {tool === 'row' && 'Clique na imagem para cortar uma linha. Arraste a linha azul para ajustar; × remove.'}
            {tool === 'col' && 'Clique dentro de uma linha para dividi-la em colunas. Arraste para ajustar; × remove.'}
            {tool === 'select' && 'Clique numa célula para definir o link e o texto alternativo.'}
            {hover && ` · ${hover.x}, ${hover.y}px`}
          </p>
        </div>

        {/* Painel lateral */}
        <div class="space-y-3">
          {showCampaign && <CampaignPanel project={project} onChange={(p) => commit(p)} />}
          <CellPanel
            info={selectedInfo}
            project={project}
            onChange={(id, p) => commit((proj) => updateCell(proj, id, p))}
            onSelectTool={() => setTool('select')}
          />
          <div class="card text-xs text-ink-3">
            <div class="font-semibold text-ink-2">Resumo</div>
            <div class="mt-1">
              {project.rows.length} linha(s) · {project.rows.reduce((a, r) => a + r.cells.length, 0)} fatia(s) ·{' '}
              {project.rows.reduce((a, r) => a + r.cells.filter((c) => c.href.trim()).length, 0)} com link
            </div>
            <div class="mt-1 break-all font-mono">{folderUrl}/</div>
          </div>
        </div>
      </div>

      {preview && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4" onClick={() => setPreview(null)}>
          <div class="flex h-[90vh] w-full max-w-[960px] flex-col overflow-hidden rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div class="flex items-center justify-between border-b border-line px-4 py-2">
              <div class="text-sm font-semibold">Pré-visualização · imagens {formatBytes(preview.total)}</div>
              <button class="btn-ghost" onClick={() => setPreview(null)}>Fechar</button>
            </div>
            {preview.warnings.length > 0 && (
              <ul class="space-y-1 border-b border-line bg-amber-50 px-4 py-2 text-xs text-warn">
                {preview.warnings.map((w) => (
                  <li>{w.level === 'error' ? '⛔ ' : '⚠️ '}{w.message}</li>
                ))}
              </ul>
            )}
            <iframe title="Pré-visualização" class="flex-1 bg-white" srcdoc={preview.html} />
          </div>
        </div>
      )}
    </div>
  );
}

function ToolButton({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: preact.ComponentChildren }) {
  return (
    <button class={`btn-tool ${active ? 'btn-tool-active' : ''}`} onClick={onClick} title={title}>
      {children}
    </button>
  );
}
