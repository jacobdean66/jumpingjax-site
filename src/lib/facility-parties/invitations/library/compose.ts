import { applyRequestedColors, parseRequestedColors } from "./colors";
import { getInvitationLibraryTheme } from "./themes";
import type {
  InvitationComposition,
  InvitationLibraryTheme,
} from "./types";

export function composeLibraryInvitation(input: {
  themeId: string;
  optionIndex?: number;
  artworkVariant?: number;
  colorHint?: string | null;
}): InvitationComposition {
  const theme = getInvitationLibraryTheme(input.themeId);
  const index = Math.max(0, Math.floor(input.optionIndex ?? input.artworkVariant ?? 0));
  const layout = theme.layouts[index % theme.layouts.length] ?? theme.layouts[0]!;
  const hero =
    theme.heroes[Math.floor(index / theme.layouts.length) % theme.heroes.length] ??
    theme.heroes[0]!;
  const paletteSource =
    theme.palettes[
      Math.floor(index / (theme.layouts.length * Math.max(1, theme.heroes.length))) %
        theme.palettes.length
    ] ?? theme.palettes[0]!;
  const requested = parseRequestedColors(input.colorHint);
  const palette = applyRequestedColors(paletteSource, requested);
  const decorations = pickDecorations(theme, index);
  return {
    themeId: theme.id,
    themeLabel: theme.label,
    layout,
    hero,
    decorations,
    palette,
  };
}

function pickDecorations(theme: InvitationLibraryTheme, index: number) {
  const list = theme.decorations;
  if (list.length === 0) return [];
  const start = index % list.length;
  const count = Math.min(4, list.length);
  return Array.from({ length: count }, (_, i) => list[(start + i) % list.length]!);
}
