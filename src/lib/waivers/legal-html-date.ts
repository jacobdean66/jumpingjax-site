/**
 * Narrow server-side date token for stored waiver legal HTML.
 *
 * Only {{WAIVER_CURRENT_DATE}} is recognized. This is not a general template
 * engine: unknown tokens are left unchanged (fail-closed against arbitrary
 * substitution). Stored body_html / body_sha256 remain the immutable source.
 *
 * Timezone: America/New_York — same business calendar used by waiver
 * expiration and Open Play business-day helpers.
 */

import { OPEN_PLAY_TIME_ZONE } from "../open-play/pricing";

/** Explicit single-token contract for Smartwaiver-equivalent current date. */
export const WAIVER_CURRENT_DATE_TOKEN = "{{WAIVER_CURRENT_DATE}}";

export const WAIVER_LEGAL_HTML_TIME_ZONE = OPEN_PLAY_TIME_ZONE;

const TOKEN_RE = /\{\{WAIVER_CURRENT_DATE\}\}/g;

/**
 * Format an instant as Smartwaiver-observed English date:
 * `August 9, 2026` (month name, day without leading zero, comma, year)
 * in America/New_York.
 */
export function formatWaiverCurrentDate(
  now: Date = new Date(),
  timeZone: string = WAIVER_LEGAL_HTML_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).formatToParts(now);
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  const year = parts.find((p) => p.type === "year")?.value;
  if (!month || !day || !year) {
    throw new Error("Unable to format waiver current date");
  }
  return `${month} ${day}, ${year}`;
}

/**
 * Replace only {{WAIVER_CURRENT_DATE}} in stored legal HTML.
 * Does not mutate the input string object beyond returning a new string.
 * Unknown `{{...}}` placeholders are preserved verbatim.
 */
export function renderWaiverLegalHtmlDateTokens(
  storedBodyHtml: string,
  options?: { now?: Date; timeZone?: string },
): string {
  if (!storedBodyHtml.includes(WAIVER_CURRENT_DATE_TOKEN)) {
    return storedBodyHtml;
  }
  const formatted = formatWaiverCurrentDate(
    options?.now ?? new Date(),
    options?.timeZone ?? WAIVER_LEGAL_HTML_TIME_ZONE,
  );
  return storedBodyHtml.replace(TOKEN_RE, formatted);
}
