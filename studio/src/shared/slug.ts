/** Converte "Civic Outubro 2026!" em "civic-outubro-2026". */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 60 && SLUG_PATTERN.test(slug);
}

/** Prefixo com ano-mês para as campanhas ficarem ordenadas no bucket. */
export function suggestSlug(name: string, date = new Date()): string {
  const base = slugify(name);
  const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  if (!base) return ym;
  if (base.startsWith(ym)) return base;
  return `${ym}-${base}`.slice(0, 60).replace(/-+$/g, '');
}
