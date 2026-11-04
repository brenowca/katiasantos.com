import type { CampaignStatus, CampaignSummary, Project, PublishResult } from '../shared/model';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch {
      /* corpo não é JSON */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export function me() {
  return fetch('/api/me').then((r) => json<{ email: string; cdnBaseUrl: string }>(r));
}

export function listCampaigns() {
  return fetch('/api/campaigns').then((r) => json<{ items: CampaignSummary[] }>(r)).then((r) => r.items);
}

export function getProject(slug: string) {
  return fetch(`/api/campaigns/${slug}`).then((r) => json<Project>(r));
}

export async function getOriginal(slug: string, filename: string): Promise<File> {
  const res = await fetch(`/api/campaigns/${slug}/original`);
  if (!res.ok) throw new Error('Não foi possível baixar a arte original.');
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type });
}

export async function getSlice(slug: string, filename: string): Promise<Uint8Array> {
  const res = await fetch(`/api/campaigns/${slug}/slice/${filename}`);
  if (!res.ok) throw new Error(`Não foi possível baixar a fatia ${filename}.`);
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Envia a arte inteira de uma campanha já publicada que ainda não tinha
 * (campanhas anteriores à exportação em imagem única). Devolve o projeto atualizado.
 */
export async function uploadFull(slug: string, filename: string, blob: Blob): Promise<Project> {
  const form = new FormData();
  form.append('full', blob, filename);
  return fetch(`/api/campaigns/${slug}/full`, { method: 'POST', body: form }).then((r) => json<Project>(r));
}

export function setStatus(slug: string, status: CampaignStatus) {
  return fetch(`/api/campaigns/${slug}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  }).then((r) => json<{ slug: string; status: CampaignStatus }>(r));
}

export function slugExists(slug: string) {
  return fetch(`/api/campaigns/${slug}/exists`).then((r) => json<{ exists: boolean }>(r)).then((r) => r.exists);
}

/** Envia com XMLHttpRequest para ter progresso de upload. */
export function publish(
  project: Project,
  html: string,
  original: File,
  slices: Map<string, Blob>,
  full: { filename: string; blob: Blob },
  onProgress?: (fraction: number) => void,
): Promise<PublishResult> {
  const form = new FormData();
  form.append('project', JSON.stringify(project));
  form.append('html', html);
  form.append('original', original, original.name);
  form.append('full', full.blob, full.filename);
  for (const [name, blob] of slices) form.append('slice', blob, name);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/campaigns/${project.slug}/publish`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText) as PublishResult & { error?: string };
        if (xhr.status >= 200 && xhr.status < 300) resolve(body);
        else reject(new Error(body.error ?? `Erro ${xhr.status}`));
      } catch {
        reject(new Error(`Erro ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Falha de rede ao publicar.'));
    xhr.send(form);
  });
}
