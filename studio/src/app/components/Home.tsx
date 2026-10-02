import { useEffect, useState } from 'preact/hooks';
import type { CampaignSummary, Project, PublishResult } from '../../shared/model';
import { generateEmailHtml } from '../../shared/html';
import { newProject } from '../../shared/model';
import { isValidSlug, suggestSlug } from '../../shared/slug';
import { getOriginal, getProject, listCampaigns, slugExists } from '../api';
import { loadImage, type LoadedImage } from '../slicer';

interface Props {
  cdnBaseUrl: string;
  onStart: (project: Project, image: LoadedImage) => void;
  onOpen: (project: Project, result: PublishResult, html: { document: string; fragment: string }) => void;
}

export function Home({ cdnBaseUrl, onStart, onOpen }: Props) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);
  const [dupBusy, setDupBusy] = useState<string | null>(null);

  useEffect(() => {
    listCampaigns()
      .then(setCampaigns)
      .catch(() => setCampaigns([]));
  }, []);

  useEffect(() => {
    if (!slugTouched) setSlug(suggestSlug(name));
  }, [name, slugTouched]);

  async function start(e: Event) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Dê um nome à campanha.');
    if (!isValidSlug(slug)) return setError('O identificador deve ter só letras minúsculas, números e hífens (mínimo 3 caracteres).');
    if (!file) return setError('Escolha a imagem do email.');
    setBusy(true);
    try {
      if (await slugExists(slug)) {
        setError(`Já existe uma campanha "${slug}". Mude o identificador.`);
        return;
      }
      const image = await loadImage(file);
      const project = newProject(name.trim(), slug, { width: image.width, height: image.height, filename: file.name });
      onStart(project, image);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Reabre uma campanha publicada só para exportar o HTML de novo. */
  async function open(c: CampaignSummary) {
    setDupBusy(c.slug);
    setError(null);
    try {
      const project = await getProject(c.slug);
      const base = (project.cdnBaseUrl ?? cdnBaseUrl).replace(/\/+$/, '');
      const html = generateEmailHtml(project, `${base}/c/${project.slug}`);
      onOpen(project, { slug: project.slug, cdnBaseUrl: base, previewUrl: `${base}/c/${project.slug}/index.html` }, html);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDupBusy(null);
    }
  }

  async function duplicate(c: CampaignSummary) {
    setDupBusy(c.slug);
    setError(null);
    try {
      const old = await getProject(c.slug);
      const original = await getOriginal(c.slug, old.source.filename);
      const image = await loadImage(original);
      const now = new Date();
      const newName = `${old.name} (cópia)`;
      const project: Project = {
        ...old,
        name: newName,
        slug: suggestSlug(newName, now),
        createdAt: now.toISOString(),
        publishedAt: undefined,
        publishedBy: undefined,
        cdnBaseUrl: undefined,
      };
      onStart(project, image);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDupBusy(null);
    }
  }

  return (
    <div class="mx-auto grid max-w-[1400px] gap-6 px-4 py-8 lg:grid-cols-[1fr_380px]">
      <form class="card space-y-5" onSubmit={start}>
        <div>
          <h1 class="text-lg font-semibold">Nova campanha</h1>
          <p class="mt-1 text-sm text-ink-3">
            Envie a arte completa do email como uma única imagem. Para ficar nítida em telas retina, exporte com{' '}
            <strong>1200px de largura</strong> (o email será exibido a 600px).
          </p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="label" for="name">Nome da campanha</label>
            <input id="name" class="input" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} placeholder="Ex.: Civic Outubro" />
          </div>
          <div>
            <label class="label" for="slug">Identificador (pasta das imagens)</label>
            <input
              id="slug"
              class="input font-mono"
              value={slug}
              onInput={(e) => {
                setSlugTouched(true);
                setSlug((e.target as HTMLInputElement).value);
              }}
            />
            <p class="mt-1 text-xs text-ink-3">Não pode repetir. Vira a URL das imagens.</p>
          </div>
        </div>

        <div>
          <label class="label" for="file">Imagem do email (PNG ou JPG)</label>
          <input
            id="file"
            type="file"
            accept="image/png,image/jpeg"
            class="block w-full text-sm text-ink-2 file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-ink-2"
            onChange={(e) => setFile((e.target as HTMLInputElement).files?.[0] ?? null)}
          />
        </div>

        {error && <div class="rounded-md border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger">{error}</div>}

        <div class="flex justify-end">
          <button type="submit" class="btn-primary" disabled={busy}>
            {busy ? 'Carregando…' : 'Abrir no editor →'}
          </button>
        </div>
      </form>

      <aside class="card">
        <h2 class="text-sm font-semibold">Campanhas publicadas</h2>
        <p class="mt-1 text-xs text-ink-3">
          <strong>Abrir</strong> mostra de novo o HTML e os links para copiar. <strong>Duplicar</strong> cria uma cópia editável; a original nunca muda.
        </p>
        <ul class="mt-3 divide-y divide-line">
          {campaigns === null && <li class="py-2 text-sm text-ink-3">Carregando…</li>}
          {campaigns?.length === 0 && <li class="py-2 text-sm text-ink-3">Nenhuma ainda.</li>}
          {campaigns?.map((c) => (
            <li key={c.slug} class="flex items-center justify-between gap-2 py-2">
              <div class="min-w-0">
                <div class="truncate text-sm font-medium">{c.name}</div>
                <div class="truncate font-mono text-xs text-ink-3">{c.slug}</div>
              </div>
              <div class="flex shrink-0 gap-1">
                <button type="button" class="btn-primary" onClick={() => open(c)} disabled={dupBusy !== null}>
                  {dupBusy === c.slug ? '…' : 'Abrir'}
                </button>
                <button type="button" class="btn-secondary" onClick={() => duplicate(c)} disabled={dupBusy !== null}>
                  Duplicar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
