import { describe, expect, it } from 'vitest';
import { isValidSlug, slugify, suggestSlug } from '../src/shared/slug';

describe('slugify', () => {
  it('remove acentos e símbolos', () => {
    expect(slugify('Civic Outubro 2026!')).toBe('civic-outubro-2026');
    expect(slugify('  Promoção de Verão  ')).toBe('promocao-de-verao');
    expect(slugify('HR-V / City')).toBe('hr-v-city');
  });
  it('sugere prefixo ano-mês', () => {
    expect(suggestSlug('Civic Outubro', new Date(2026, 9, 1))).toBe('2026-10-civic-outubro');
    expect(suggestSlug('2026-10-civic', new Date(2026, 9, 1))).toBe('2026-10-civic');
    expect(suggestSlug('', new Date(2026, 9, 1))).toBe('2026-10');
  });
  it('valida', () => {
    expect(isValidSlug('2026-10-civic')).toBe(true);
    expect(isValidSlug('-civic')).toBe(false);
    expect(isValidSlug('ab')).toBe(false);
    expect(isValidSlug('Civic')).toBe(false);
  });
});
