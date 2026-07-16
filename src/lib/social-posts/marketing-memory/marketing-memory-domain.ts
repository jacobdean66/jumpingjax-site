import type {
  MarketingMemoryDuplicateWarning,
  MarketingMemoryHistoryItem,
  MarketingMemoryPost,
} from "./marketing-memory-types";

const HOLIDAY_TOKENS = [
  "christmas",
  "easter",
  "halloween",
  "thanksgiving",
  "memorial day",
  "labor day",
  "fourth of july",
  "july 4",
  "new year",
  "valentine",
] as const;

const CATEGORY_TOKENS = [
  "bounce house",
  "water slide",
  "combo",
  "obstacle course",
  "foam party",
  "dunk tank",
  "concession",
] as const;

export function normalizeMarketingMemoryText(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function marketingMemoryTokens(value: string | null | undefined): string[] {
  return normalizeMarketingMemoryText(value)
    .split(" ")
    .filter((token) => token.length > 1);
}

export function extractMarketingMemoryHashtags(
  caption: string | null | undefined,
): string[] {
  return Array.from(
    new Set(
      (caption ?? "")
        .toLowerCase()
        .match(/#[a-z0-9_]+/g)
        ?.map((tag) => tag.slice(1)) ?? [],
    ),
  );
}

export function captionSimilarity(left: string, right: string): number {
  const leftTokens = new Set(marketingMemoryTokens(left));
  const rightTokens = new Set(marketingMemoryTokens(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

export function findCaptionDuplicateWarnings(
  posts: readonly MarketingMemoryPost[],
): MarketingMemoryDuplicateWarning[] {
  const warnings: MarketingMemoryDuplicateWarning[] = [];
  const withCaptions = posts.filter((post) => Boolean(normalizeMarketingMemoryText(post.caption)));

  for (let leftIndex = 0; leftIndex < withCaptions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < withCaptions.length; rightIndex += 1) {
      const left = withCaptions[leftIndex];
      const right = withCaptions[rightIndex];
      const normalizedLeft = normalizeMarketingMemoryText(left.caption);
      const normalizedRight = normalizeMarketingMemoryText(right.caption);
      const identical = normalizedLeft === normalizedRight;
      const similarity = captionSimilarity(normalizedLeft, normalizedRight);

      if (!identical && similarity < 0.8) continue;
      warnings.push({
        kind: identical ? "identical_caption" : "similar_caption",
        value: normalizedLeft,
        postIds: [left.id, right.id],
        message: identical
          ? "Two posts use the same normalized caption."
          : `Two captions share ${Math.round(similarity * 100)}% of normalized tokens.`,
      });
    }
  }
  return warnings;
}

export function extractHolidayMessaging(value: string): string[] {
  const normalized = normalizeMarketingMemoryText(value);
  return HOLIDAY_TOKENS.filter((holiday) => normalized.includes(holiday));
}

export function extractPromotedCategories(value: string): string[] {
  const normalized = normalizeMarketingMemoryText(value);
  return CATEGORY_TOKENS.filter((category) => normalized.includes(category));
}

export function collectHistory(
  values: readonly { value: string; at: string }[],
): MarketingMemoryHistoryItem[] {
  const groups = new Map<string, { count: number; mostRecentAt: string }>();
  for (const { value, at } of values) {
    const cleaned = value.trim();
    if (!cleaned) continue;
    const current = groups.get(cleaned);
    if (!current) {
      groups.set(cleaned, { count: 1, mostRecentAt: at });
    } else {
      current.count += 1;
      if (Date.parse(at) > Date.parse(current.mostRecentAt)) current.mostRecentAt = at;
    }
  }
  return [...groups.entries()]
    .map(([value, history]) => ({ value, ...history }))
    .sort(
      (left, right) =>
        Date.parse(right.mostRecentAt) - Date.parse(left.mostRecentAt) ||
        right.count - left.count ||
        left.value.localeCompare(right.value),
    );
}
