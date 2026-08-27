/**
 * Contrast helpers for invitation palettes with dynamic theme colors.
 * Targets WCAG AA-ish readability without blocking themed designs.
 */

const FALLBACK_LIGHT = "#ffffff";
const FALLBACK_DARK = "#0f172a";

function clampChannel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(255, Math.max(0, value));
}

/** Parse #rgb / #rrggbb / rgb()/rgba() into 0–255 channels. */
export function parseCssColor(
  input: string | null | undefined,
): { r: number; g: number; b: number } | null {
  const raw = input?.trim();
  if (!raw) return null;

  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const body = hex[1];
    if (body.length === 3) {
      return {
        r: Number.parseInt(body[0] + body[0], 16),
        g: Number.parseInt(body[1] + body[1], 16),
        b: Number.parseInt(body[2] + body[2], 16),
      };
    }
    return {
      r: Number.parseInt(body.slice(0, 2), 16),
      g: Number.parseInt(body.slice(2, 4), 16),
      b: Number.parseInt(body.slice(4, 6), 16),
    };
  }

  const rgb = raw.match(
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*[0-9.]+\s*)?\)$/i,
  );
  if (rgb) {
    return {
      r: clampChannel(Number.parseFloat(rgb[1])),
      g: clampChannel(Number.parseFloat(rgb[2])),
      b: clampChannel(Number.parseFloat(rgb[3])),
    };
  }

  return null;
}

function channelToLinear(channel: number): number {
  const c = clampChannel(channel) / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: string): number {
  const parsed = parseCssColor(color);
  if (!parsed) return 0;
  const r = channelToLinear(parsed.r);
  const g = channelToLinear(parsed.g);
  const b = channelToLinear(parsed.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Prefer the theme text color when it already contrasts; otherwise flip to
 * white or near-black against the background.
 */
export function pickReadableTextColor(
  background: string,
  preferredText?: string | null,
  minimumRatio = 4.5,
): string {
  const preferred = preferredText?.trim();
  if (preferred && contrastRatio(preferred, background) >= minimumRatio) {
    return preferred;
  }

  const whiteRatio = contrastRatio(FALLBACK_LIGHT, background);
  const darkRatio = contrastRatio(FALLBACK_DARK, background);
  return whiteRatio >= darkRatio ? FALLBACK_LIGHT : FALLBACK_DARK;
}

export function readableMutedTextColor(
  background: string,
  preferredMuted?: string | null,
  minimumRatio = 3,
): string {
  return pickReadableTextColor(background, preferredMuted, minimumRatio);
}
