import { strToU8, zipSync } from 'fflate';
import { useState } from 'preact/hooks';
import { slices } from '../../shared/geometry';
import { generateEmailHtml } from '../../shared/html';
import type { Project, PublishResult } from '../../shared/model';
import { getSlice } from '../api';

interface Props {
  project: Project;
  result: PublishResult;
  html: { document: string; fragment: string };
  onNew: () => void;
}

export function Published({ project, result, html, onNew }: Props) {
  const [msg, setMsg] = useState<string | null>(null);
  const [packing, setPacking] = useState(false);

  function flash(s: string) {
    setMsg(s);
    setTimeout(() => setMsg(null), 2500);
  }

  async function copyHtml() {
    await navigator.clipboard.writeText(html.document);
    flash('HTML copiado. Cole na plataforma de disparo.');
  }

  /** Copia como conteúdo rico: colar direto na janela de composição do Gmail. */
  async function copyRich() {
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([html.fragment], { type: 'text/html' }),
        'text/plain': new Blob([result.previewUrl], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
      flash('Email copiado. Abra o Gmail, crie uma mensagem e cole (⌘V).');
    } catch {
      flash('Seu navegador não permitiu copiar como email. Abra a prévia, selecione tudo e copie.');
    }
  }

  function saveBlob(blob: Blob, filename: string) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /**
   * Pacote .zip: <slug>/<slug>.html com caminhos relativos + <slug>/imagens/*.
   * Serve para quem quer hospedar as imagens no próprio servidor ou plataforma.
   */
  async function downloadPackage() {
    setPacking(true);
    try {
      const refs = slices(project);
      const files: Record<string, Uint8Array> = {};
      for (const r of refs) {
        files[`${project.slug}/imagens/${r.filename}`] = await getSlice(project.slug, r.filename);
      }
      const relative = generateEmailHtml(project, 'imagens').document;
      files[`${project.slug}/${project.slug}.html`] = strToU8(relative);
      // Imagens já são comprimidas; sem compressão o zip sai mais rápido.
      const zipped = zipSync(files, { level: 0 });
      saveBlob(new Blob([zipped], { type: 'application/zip' }), `${project.slug}.zip`);
      flash('Pacote gerado. Dentro, o HTML aponta para a pasta imagens/.');
    } catch (err) {
      flash((err as Error).message);
    } finally {
      setPacking(false);
    }
  }

  function download() {
    saveBlob(new Blob([html.document], { type: 'text/html' }), `${project.slug}.html`);
  }

  return (
    <div class="mx-auto grid max-w-[1400px] gap-6 px-4 py-8 lg:grid-cols-[420px_1fr]">
      <div class="space-y-4">
        <div class="card">
          <div class="text-xs font-semibold uppercase tracking-wide text-accent">
            {project.publishedAt ? `Publicado em ${new Date(project.publishedAt).toLocaleDateString('pt-BR')}` : 'Publicado'}
          </div>
          <h1 class="mt-1 text-lg font-semibold">{project.name}</h1>
          <p class="mt-1 break-all font-mono text-xs text-ink-3">{result.cdnBaseUrl}/c/{result.slug}/</p>
        </div>

        <div class="card space-y-2">
          <button class="btn-primary w-full justify-center" onClick={copyHtml}>Copiar HTML</button>
          <p class="text-xs text-ink-3">Para a equipe da Honda ou qualquer plataforma que aceite HTML.</p>
          <button class="btn-secondary w-full justify-center" onClick={copyRich}>Copiar como email (Gmail)</button>
          <p class="text-xs text-ink-3">Cole direto na mensagem. Os links e imagens vêm junto.</p>
          <button class="btn-secondary w-full justify-center" onClick={download}>Baixar arquivo .html</button>
          <button class="btn-secondary w-full justify-center" onClick={downloadPackage} disabled={packing}>
            {packing ? 'Montando pacote…' : 'Baixar pacote .zip (HTML + imagens)'}
          </button>
          <p class="text-xs text-ink-3">Para quem prefere hospedar as imagens no próprio servidor. O HTML usa a pasta imagens/.</p>
          <a class="btn-secondary w-full justify-center" href={result.previewUrl} target="_blank" rel="noopener">
            Abrir prévia ↗
          </a>
          <p class="text-xs text-ink-3">Link público para mandar a quem precisa aprovar.</p>
        </div>

        {msg && <div class="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">{msg}</div>}

        <button class="btn-ghost" onClick={onNew}>← Nova campanha</button>
      </div>

      <div class="card overflow-hidden p-0">
        <iframe title="Email publicado" class="h-[80vh] w-full bg-white" srcdoc={html.document} />
      </div>
    </div>
  );
}
