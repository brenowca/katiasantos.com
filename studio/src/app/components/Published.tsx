import { strToU8, zipSync } from 'fflate';
import { useState } from 'preact/hooks';
import { slices } from '../../shared/geometry';
import { generateEmailHtml, generateMyHondaFragment, generateMyHondaImageMap, linkCount } from '../../shared/html';
import type { Project, PublishResult } from '../../shared/model';
import { getOriginal, getSlice, uploadFull } from '../api';
import { loadImage, renderFull } from '../slicer';

interface Props {
  project: Project;
  result: PublishResult;
  html: { document: string; fragment: string };
  onNew: () => void;
}

export function Published({ project: initial, result, html, onNew }: Props) {
  const [project, setProject] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [packing, setPacking] = useState(false);
  const [preparing, setPreparing] = useState(false);
  /** Exportação aguardando confirmação porque a campanha não tem nenhum link. */
  const [pending, setPending] = useState<(() => void) | null>(null);
  const noLinks = linkCount(project) === 0;

  /**
   * Toda exportação passa por aqui: sem nenhum link, pede confirmação antes.
   * A confirmação é na página (não window.confirm) para o clique em "Exportar
   * mesmo assim" valer como gesto do usuário na área de transferência.
   */
  function guard(action: () => void) {
    return () => (noLinks ? setPending(() => action) : action());
  }

  function confirmPending() {
    const action = pending;
    setPending(null);
    action?.();
  }

  function flash(s: string) {
    setMsg(s);
    setTimeout(() => setMsg(null), 2500);
  }

  /**
   * Garante a arte inteira na pasta da campanha. Campanhas publicadas antes
   * da exportação em imagem única geram e enviam na hora, uma vez só.
   */
  async function ensureFull(): Promise<Project> {
    if (project.fullImage) return project;
    setPreparing(true);
    try {
      flash('Gerando a arte inteira desta campanha (só na primeira vez)…');
      const file = await getOriginal(project.slug, project.source.filename);
      const image = await loadImage(file);
      const full = await renderFull(image, project);
      const updated = await uploadFull(project.slug, full.filename, full.blob);
      setProject(updated);
      return updated;
    } finally {
      setPreparing(false);
    }
  }

  /**
   * Imagem única com mapa de links, no molde exato de uma campanha aprovada
   * no myHonda. O texto vai para a área de transferência só depois de a arte
   * inteira existir, por isso pode demorar um instante na primeira vez.
   */
  async function copyMyHonda() {
    try {
      const p = await ensureFull();
      const frag = generateMyHondaImageMap(p, `${result.cdnBaseUrl}/c/${p.slug}`, p.fullImage!);
      await navigator.clipboard.writeText(frag);
      flash('HTML para myHonda copiado: imagem única com mapa de links, rodapé e contador de abertura.');
    } catch (err) {
      flash((err as Error).message);
    }
  }

  /** Mesmo conteúdo do copiar, como arquivo .txt para anexar ou enviar à plataforma. */
  async function downloadMyHondaTxt() {
    try {
      const p = await ensureFull();
      const frag = generateMyHondaImageMap(p, `${result.cdnBaseUrl}/c/${p.slug}`, p.fullImage!);
      saveBlob(new Blob([frag], { type: 'text/plain;charset=utf-8' }), `${p.slug}-myhonda.txt`);
      flash('Arquivo .txt para myHonda gerado: imagem única com mapa de links, rodapé e contador de abertura.');
    } catch (err) {
      flash((err as Error).message);
    }
  }

  /** Versão anterior: tabela de fatias, para comparação caso a plataforma recuse a imagem única. */
  async function copyMyHondaSliced() {
    const frag = generateMyHondaFragment(project, `${result.cdnBaseUrl}/c/${project.slug}`);
    await navigator.clipboard.writeText(frag);
    flash('HTML fatiado para myHonda copiado (versão em tabela).');
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
          <button class="btn-primary w-full justify-center" onClick={guard(downloadMyHondaTxt)} disabled={preparing}>
            {preparing ? 'Preparando…' : 'Baixar .txt para myHonda'}
          </button>
          <p class="text-xs text-ink-3">
            Imagem única com mapa de links, no molde exato de uma campanha aprovada: rodapé obrigatório e contador de abertura incluídos.
          </p>
          <button class="btn-secondary w-full justify-center" onClick={guard(copyMyHonda)} disabled={preparing}>
            Copiar para myHonda
          </button>
          <p class="text-xs text-ink-3">O mesmo conteúdo do .txt, direto na área de transferência.</p>
          <button class="btn-secondary w-full justify-center" onClick={guard(copyMyHondaSliced)}>Copiar para myHonda (fatiado)</button>
          <p class="text-xs text-ink-3">Versão anterior, em tabela de fatias. Use só se a imagem única for recusada.</p>
          <button class="btn-secondary w-full justify-center" onClick={guard(copyHtml)}>Copiar HTML completo</button>
          <p class="text-xs text-ink-3">Documento inteiro, para outras plataformas de disparo.</p>
          <button class="btn-secondary w-full justify-center" onClick={guard(copyRich)}>Copiar como email (Gmail)</button>
          <p class="text-xs text-ink-3">Cole direto na mensagem. Os links e imagens vêm junto.</p>
          <button class="btn-secondary w-full justify-center" onClick={guard(download)}>Baixar arquivo .html</button>
          <button class="btn-secondary w-full justify-center" onClick={guard(downloadPackage)} disabled={packing}>
            {packing ? 'Montando pacote…' : 'Baixar pacote .zip (HTML + imagens)'}
          </button>
          <p class="text-xs text-ink-3">Para quem prefere hospedar as imagens no próprio servidor. O HTML usa a pasta imagens/.</p>
          <a class="btn-secondary w-full justify-center" href={result.previewUrl} target="_blank" rel="noopener">
            Abrir prévia ↗
          </a>
          <p class="text-xs text-ink-3">Link público para mandar a quem precisa aprovar.</p>
        </div>

        {pending && (
          <div class="space-y-3 rounded-lg border border-line bg-amber-50 p-4 text-warn" role="alertdialog" aria-labelledby="no-links-title">
            <h2 id="no-links-title" class="text-sm font-semibold">Esta campanha não tem nenhum link</h2>
            <p class="text-sm text-ink-3">
              Nenhuma célula tem link: o email não terá nada clicável e o mapa de links do myHonda sairá vazio. Para corrigir,
              duplique a campanha, corte as áreas clicáveis, preencha os links e publique de novo.
            </p>
            <div class="flex gap-2">
              <button class="btn-secondary flex-1 justify-center" onClick={() => setPending(null)}>Cancelar</button>
              <button class="btn-primary flex-1 justify-center" onClick={confirmPending}>Exportar mesmo assim</button>
            </div>
          </div>
        )}

        {msg && <div class="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">{msg}</div>}

        <button class="btn-ghost" onClick={onNew}>← Nova campanha</button>
      </div>

      <div class="card overflow-hidden p-0">
        <iframe title="Email publicado" class="h-[80vh] w-full bg-white" srcdoc={html.document} />
      </div>
    </div>
  );
}
