export function relativeLuminance(hex: string): number {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6) return 0;
  const r = Number.parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = Number.parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = Number.parseInt(cleaned.slice(4, 6), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const NAMED_COLORS: Record<string, string> = {
  pink: "#db2777",
  purple: "#7c3aed",
  violet: "#6d28d9",
  blue: "#2563eb",
  navy: "#1e3a8a",
  sky: "#0284c7",
  teal: "#0f766e",
  green: "#16a34a",
  lime: "#65a30d",
  yellow: "#eab308",
  gold: "#d97706",
  orange: "#ea580c",
  red: "#dc2626",
  crimson: "#b91c1c",
  black: "#0f172a",
  white: "#f8fafc",
  silver: "#94a3b8",
  gray: "#64748b",
  grey: "#64748b",
  cyan: "#06b6d4",
  magenta: "#c026d3",
};

export function parseRequestedColors(raw: string | null | undefined): string[] {
  const normalized = (raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9#\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return [];
  const found: string[] = [];
  const hexes = normalized.match(/#[0-9a-f]{6}/g) ?? [];
  for (const hex of hexes) {
    if (!found.includes(hex)) found.push(hex);
  }
  for (const [name, hex] of Object.entries(NAMED_COLORS)) {
    if (new RegExp(`(?:^| )${name}(?: |$)`).test(` ${normalized} `)) {
      if (!found.includes(hex)) found.push(hex);
    }
  }
  return found.slice(0, 3);
}

export function readableTextOn(background: string): string {
  return contrastRatio("#0f172a", background) >= contrastRatio("#f8fafc", background)
    ? "#0f172a"
    : "#f8fafc";
}

export function applyRequestedColors<
  T extends {
    background: string;
    backgroundAlt: string;
    accent: string;
    accent2: string;
    text: string;
    muted: string;
    border: string;
  },
>(palette: T, requested: readonly string[]): T {
  if (requested.length === 0) return palette;
  const primary = requested[0]!;
  const secondary = requested[1] ?? palette.backgroundAlt;
  const accent = requested[2] ?? palette.accent;
  const text = readableTextOn(primary);
  const muted = text === "#f8fafc" ? "#e2e8f0" : "#334155";
  const next = {
    ...palette,
    background: primary,
    backgroundAlt: secondary,
    accent,
    accent2: secondary,
    text,
    muted,
    border: accent,
  };
  if (contrastRatio(next.text, next.background) < 4.5) {
    return palette;
  }
  return next;
}
