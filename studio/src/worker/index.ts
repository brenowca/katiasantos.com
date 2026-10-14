import { Hono } from 'hono';
import { isValidSlug } from '../shared/slug';
import type { CampaignStatus, CampaignSummary, Project, PublishResult } from '../shared/model';
import { requireAccess, type AccessEnv, type AccessUser } from './access';

export interface Env extends AccessEnv {
  BUCKET: R2Bucket;
  CDN_BASE_URL: string;
  LEGACY_CDN_BASE_URL: string;
  ASSETS: Fetcher;
}

type App = { Bindings: Env; Variables: { user: AccessUser } };

const IMMUTABLE = 'public, max-age=31536000, immutable';
const PREFIX = 'c/';

const app = new Hono<App>();

app.use('/api/*', requireAccess);

app.get('/api/me', (c) => c.json({ email: c.get('user').email, cdnBaseUrl: c.env.CDN_BASE_URL }));

/** Todas as pastas de campanha, paginando o bucket. */
async function listSlugs(bucket: R2Bucket): Promise<string[]> {
  const slugs: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: PREFIX, delimiter: '/', cursor });
    for (const p of page.delimitedPrefixes) slugs.push(p.slice(PREFIX.length).replace(/\/$/, ''));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return slugs;
}

/** Lista campanhas publicadas (mais recentes primeiro), com o estado de cada uma. */
app.get('/api/campaigns', async (c) => {
  const slugs = await listSlugs(c.env.BUCKET);
  const summaries = await Promise.all(
    slugs.map(async (slug): Promise<CampaignSummary | null> => {
      const obj = await c.env.BUCKET.get(`${PREFIX}${slug}/project.json`);
      if (!obj) return null;
      try {
        const p = (await obj.json()) as Project;
        return { slug, name: p.name, createdAt: p.createdAt, status: p.status ?? 'active' };
      } catch {
        return null;
      }
    }),
  );
  const items = summaries.filter((s): s is CampaignSummary => s !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return c.json({ items });
});

app.get('/api/campaigns/:slug', async (c) => {
  const slug = c.req.param('slug');
  if (!isValidSlug(slug)) return c.json({ error: 'Slug inválido.' }, 400);
  const obj = await c.env.BUCKET.get(`${PREFIX}${slug}/project.json`);
  if (!obj) return c.json({ error: 'Campanha não encontrada.' }, 404);
  const project = (await obj.json()) as Project;
  // Campanhas publicadas antes do domínio neutro não gravavam a base: eram todas no domínio da Kátia.
  if (!project.cdnBaseUrl) project.cdnBaseUrl = c.env.LEGACY_CDN_BASE_URL;
  return c.json(project);
});

/** Entrega a arte original pela mesma origem (evita CORS ao desenhar no canvas). */
app.get('/api/campaigns/:slug/original', async (c) => {
  const slug = c.req.param('slug');
  if (!isValidSlug(slug)) return c.json({ error: 'Slug inválido.' }, 400);
  const obj = await c.env.BUCKET.get(`${PREFIX}${slug}/original`);
  if (!obj) return c.json({ error: 'Original não encontrado.' }, 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'private, max-age=0');
  return new Response(obj.body, { headers });
});

/** Entrega uma fatia pela mesma origem (usada no download do pacote .zip). */
app.get('/api/campaigns/:slug/slice/:filename', async (c) => {
  const slug = c.req.param('slug');
  const filename = c.req.param('filename');
  if (!isValidSlug(slug)) return c.json({ error: 'Slug inválido.' }, 400);
  if (!/^[0-9]{2}(-[a-z])?\.(jpg|png)$/.test(filename)) return c.json({ error: 'Nome de fatia inválido.' }, 400);
  const obj = await c.env.BUCKET.get(`${PREFIX}${slug}/${filename}`);
  if (!obj) return c.json({ error: 'Fatia não encontrada.' }, 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'private, max-age=0');
  return new Response(obj.body, { headers });
});

const STATUSES: CampaignStatus[] = ['active', 'approved', 'archived'];

/**
 * Muda o estado da campanha na lista (ativa, aprovada, arquivada).
 * Reescreve só o project.json; imagens e index.html ficam intactos.
 */
app.post('/api/campaigns/:slug/status', async (c) => {
  const slug = c.req.param('slug');
  if (!isValidSlug(slug)) return c.json({ error: 'Slug inválido.' }, 400);
  const body = (await c.req.json().catch(() => null)) as { status?: string } | null;
  const status = body?.status as CampaignStatus | undefined;
  if (!status || !STATUSES.includes(status)) return c.json({ error: 'Estado inválido.' }, 400);
  const key = `${PREFIX}${slug}/project.json`;
  const obj = await c.env.BUCKET.get(key);
  if (!obj) return c.json({ error: 'Campanha não encontrada.' }, 404);
  const project = (await obj.json()) as Project;
  project.status = status;
  project.statusChangedAt = new Date().toISOString();
  project.statusChangedBy = c.get('user').email;
  await c.env.BUCKET.put(key, JSON.stringify(project, null, 2), {
    httpMetadata: { contentType: 'application/json', cacheControl: 'no-store' },
  });
  return c.json({ slug, status });
});

app.get('/api/campaigns/:slug/exists', async (c) => {
  const slug = c.req.param('slug');
  if (!isValidSlug(slug)) return c.json({ error: 'Slug inválido.' }, 400);
  const head = await c.env.BUCKET.head(`${PREFIX}${slug}/project.json`);
  return c.json({ exists: head !== null });
});

/**
 * Publica uma campanha. Multipart com:
 *  - project: JSON do projeto
 *  - html: documento HTML final
 *  - original: arte completa (imagem)
 *  - slice: um campo por fatia; o nome do arquivo vem do File.name
 * A pasta é imutável: slug já existente é recusado com 409.
 */
app.post('/api/campaigns/:slug/publish', async (c) => {
  const slug = c.req.param('slug');
  if (!isValidSlug(slug)) return c.json({ error: 'Slug inválido.' }, 400);
  const folder = `${PREFIX}${slug}/`;

  if (await c.env.BUCKET.head(`${folder}project.json`)) {
    return c.json({ error: `Já existe uma campanha com o nome "${slug}". Escolha outro nome.` }, 409);
  }

  const form = await c.req.formData();
  const projectRaw = form.get('project');
  const html = form.get('html');
  const original = form.get('original');
  const slices = form.getAll('slice').filter((f): f is File => f instanceof File);

  if (typeof projectRaw !== 'string' || typeof html !== 'string' || !(original instanceof File)) {
    return c.json({ error: 'Formulário incompleto.' }, 400);
  }
  let project: Project;
  try {
    project = JSON.parse(projectRaw) as Project;
  } catch {
    return c.json({ error: 'Projeto inválido.' }, 400);
  }
  if (project.slug !== slug) return c.json({ error: 'Slug do projeto não confere.' }, 400);
  if (!slices.length) return c.json({ error: 'Nenhuma fatia enviada.' }, 400);
  for (const s of slices) {
    if (!/^[0-9]{2}(-[a-z])?\.(jpg|png)$/.test(s.name)) return c.json({ error: `Nome de fatia inválido: ${s.name}` }, 400);
  }

  const cdnBaseUrl = c.env.CDN_BASE_URL.replace(/\/+$/, '');
  project.publishedBy = c.get('user').email;
  project.publishedAt = new Date().toISOString();
  project.cdnBaseUrl = cdnBaseUrl;

  // Grava as fatias primeiro; project.json por último, pois é ele que marca a campanha como existente.
  await Promise.all(
    slices.map((s) =>
      c.env.BUCKET.put(`${folder}${s.name}`, s.stream(), {
        httpMetadata: { contentType: s.type || (s.name.endsWith('.png') ? 'image/png' : 'image/jpeg'), cacheControl: IMMUTABLE },
      }),
    ),
  );
  await c.env.BUCKET.put(`${folder}original`, original.stream(), {
    httpMetadata: { contentType: original.type || 'application/octet-stream', cacheControl: IMMUTABLE },
    customMetadata: { filename: original.name },
  });
  await c.env.BUCKET.put(`${folder}index.html`, html, {
    httpMetadata: { contentType: 'text/html; charset=utf-8', cacheControl: 'public, max-age=300' },
  });
  await c.env.BUCKET.put(`${folder}project.json`, JSON.stringify(project, null, 2), {
    httpMetadata: { contentType: 'application/json', cacheControl: 'no-store' },
  });

  const result: PublishResult = { slug, previewUrl: `${cdnBaseUrl}/${folder}index.html`, cdnBaseUrl };
  return c.json(result, 201);
});

app.notFound((c) => c.json({ error: 'Rota não encontrada.' }, 404));

export default app;
