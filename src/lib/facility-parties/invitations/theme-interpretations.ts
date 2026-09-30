import type { ThemeSearchRequest } from './theme-search';

export function normalizeThemeLabel(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ').replace(/\bk pop\b/g, 'kpop');
}

/** Resolve ambiguity with the customer before looking for a picture. */
export function themeInterpretations(input: ThemeSearchRequest): string[] {
  if (/^k\s*pop$/.test(normalizeThemeLabel(input.query)) && !input.refinements.length) {
    return ['General K-pop music party', 'KPop Demon Hunters animated movie characters'];
  }
  return [];
}

export function themeCatalogQuery(input: ThemeSearchRequest): string {
  return normalizeThemeLabel([input.query, ...input.refinements].join(' '))
    .split(' ').filter(word => !['the','a','an','from','characters','character','please','picture','of'].includes(word)).join(' ');
}
