import {
  FALLBACK_THEME_IDS,
  getInvitationTheme,
  INVITATION_STYLE_FAMILIES,
  INVITATION_THEMES,
  type InvitationArtworkKind,
  type InvitationStyleFamily,
  type InvitationThemeDefinition,
} from "./theme-catalog";

export type InvitationMatchKind =
  | "exact"
  | "alias"
  | "fuzzy"
  | "family"
  | "fallback";

export type InvitationMatch = {
  themeId: string;
  themeLabel: string;
  styleFamily: InvitationStyleFamily;
  artworkSlot: string;
  artworkKind: InvitationArtworkKind;
  artworkVariant: number;
  matchKind: InvitationMatchKind;
  matchedAlias: string | null;
  normalizedSource: string;
};

export const MAX_INVITATION_ALTERNATE_LOADS = 3;
export const INVITATION_OPTION_COUNT = MAX_INVITATION_ALTERNATE_LOADS + 1;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "the",
  "party",
  "theme",
  "themed",
  "birthday",
  "bday",
  "inspired",
  "for",
  "my",
  "kids",
  "kid",
]);

type AliasIndexEntry = {
  theme: InvitationThemeDefinition;
  alias: string;
  compact: string;
  tokens: string[];
};

function compact(value: string): string {
  return value.replace(/\s+/g, "");
}

export function normalizeThemeText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantTokens(normalized: string): string[] {
  return normalized.split(" ").filter((token) => token && !STOP_WORDS.has(token));
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  const curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (curr[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      );
    }
    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j] ?? 0;
    }
  }
  return prev[b.length] ?? Math.max(a.length, b.length);
}

function fuzzyThreshold(length: number): number {
  if (length <= 4) return 1;
  if (length <= 8) return 2;
  return 3;
}

function artworkKindFor(_theme: InvitationThemeDefinition): InvitationArtworkKind {
  void _theme;
  return "approved";
}

function toMatch(
  theme: InvitationThemeDefinition,
  matchKind: InvitationMatchKind,
  matchedAlias: string | null,
  normalizedSource: string,
  artworkVariant = 0,
): InvitationMatch {
  return {
    themeId: theme.id,
    themeLabel: theme.label,
    styleFamily: theme.family,
    artworkSlot: theme.artworkSlot,
    artworkKind: artworkKindFor(theme),
    artworkVariant,
    matchKind,
    matchedAlias,
    normalizedSource,
  };
}

const ALIAS_INDEX: AliasIndexEntry[] = INVITATION_THEMES.flatMap((theme) =>
  theme.aliases.map((alias) => {
    const normalized = normalizeThemeText(alias);
    return {
      theme,
      alias: normalized,
      compact: compact(normalized),
      tokens: significantTokens(normalized),
    };
  }),
).sort((a, b) => b.compact.length - a.compact.length);

const FAMILY_PRIORITY: InvitationStyleFamily[] = [
  "sports",
  "princess",
  "gamer",
  "superhero",
  "animal",
  "colorful",
  "birthday",
];

function fallbackTheme(family: InvitationStyleFamily): InvitationThemeDefinition {
  return getInvitationTheme(FALLBACK_THEME_IDS[family]);
}

export function matchInvitationTheme(rawTheme: string): InvitationMatch {
  const normalized = normalizeThemeText(rawTheme ?? "");
  const tokens = significantTokens(normalized);
  const compactSource = compact(tokens.join(" ") || normalized);

  if (!normalized && !compactSource) {
    return toMatch(fallbackTheme("birthday"), "fallback", null, "");
  }

  for (const entry of ALIAS_INDEX) {
    if (normalized === entry.alias || compactSource === entry.compact) {
      return toMatch(
        entry.theme,
        normalized === entry.alias ? "exact" : "alias",
        entry.alias,
        normalized,
      );
    }
  }

  for (const entry of ALIAS_INDEX) {
    if (!entry.alias) continue;
    if (
      ` ${normalized} `.includes(` ${entry.alias} `) ||
      (entry.compact.length >= 5 && compactSource.includes(entry.compact))
    ) {
      return toMatch(entry.theme, "alias", entry.alias, normalized);
    }
  }

  let bestFuzzy: { entry: AliasIndexEntry; distance: number } | null = null;
  for (const entry of ALIAS_INDEX) {
    if (entry.compact.length < 4 || compactSource.length < 4) continue;
    const distance = levenshtein(compactSource, entry.compact);
    if (distance > fuzzyThreshold(Math.max(compactSource.length, entry.compact.length))) {
      continue;
    }
    if (!bestFuzzy || distance < bestFuzzy.distance) {
      bestFuzzy = { entry, distance };
    }
  }
  if (bestFuzzy) {
    return toMatch(
      bestFuzzy.entry.theme,
      "fuzzy",
      bestFuzzy.entry.alias,
      normalized,
    );
  }

  for (const family of FAMILY_PRIORITY) {
    const familyTheme = fallbackTheme(family);
    const familyHit = ALIAS_INDEX.some(
      (entry) =>
        entry.theme.family === family &&
        entry.tokens.some((token) => tokens.includes(token) && token.length >= 4),
    );
    if (familyHit) {
      return toMatch(familyTheme, "family", family, normalized);
    }
  }

  return toMatch(fallbackTheme("birthday"), "fallback", null, normalized);
}

export function isInvitationStyleFamily(
  value: string,
): value is InvitationStyleFamily {
  return (INVITATION_STYLE_FAMILIES as readonly string[]).includes(value);
}

export function clampInvitationOptionIndex(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 0) return 0;
  return Math.min(n, MAX_INVITATION_ALTERNATE_LOADS);
}

/**
 * Deterministic invitation options for one typed theme.
 * Index 0 is the first match; indexes 1–3 cycle layout, hero, and palette
 * inside the same matched library theme.
 */
export function listInvitationOptions(rawTheme: string): InvitationMatch[] {
  const primary = matchInvitationTheme(rawTheme);
  const primaryTheme = getInvitationTheme(primary.themeId);
  const options: InvitationMatch[] = [];
  const seen = new Set<string>();

  const add = (
    theme: InvitationThemeDefinition,
    matchKind: InvitationMatchKind,
    artworkVariant: number,
    matchedAlias: string | null,
  ) => {
    if (options.length >= INVITATION_OPTION_COUNT) return;
    const key = `${theme.id}:${artworkVariant}`;
    if (seen.has(key)) return;
    seen.add(key);
    options.push(
      toMatch(
        theme,
        matchKind,
        matchedAlias,
        primary.normalizedSource,
        artworkVariant,
      ),
    );
  };

  add(primaryTheme, primary.matchKind, 0, primary.matchedAlias);
  add(primaryTheme, primary.matchKind, 1, primary.matchedAlias);
  add(primaryTheme, primary.matchKind, 2, primary.matchedAlias);
  add(primaryTheme, primary.matchKind, 3, primary.matchedAlias);

  return options.slice(0, INVITATION_OPTION_COUNT);
}
