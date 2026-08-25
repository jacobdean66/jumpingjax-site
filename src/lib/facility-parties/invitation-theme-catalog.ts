export type FacilityInvitationGraphicVariant =
  | "party"
  | "princess"
  | "sports"
  | "glow"
  | "superhero"
  | "game"
  | "blocks"
  | "cartoon"
  | "fashion"
  | "dinosaur"
  | "racing"
  | "space"
  | "water"
  | "animal";

export type FacilityInvitationThemeCatalogEntry = Readonly<{
  id: string;
  label: string;
  aliases: readonly string[];
  category:
    | "character"
    | "game"
    | "tv"
    | "movie"
    | "team"
    | "sports"
    | "classic"
    | "fallback";
  accent: string;
  secondary: string;
  background: string;
  border: string;
  graphicLabel: string;
  graphicVariant: FacilityInvitationGraphicVariant;
  approvedArtworkSlot: string | null;
}>;

const COMMON_WORDS = new Set([
  "a",
  "an",
  "and",
  "birthday",
  "bday",
  "for",
  "kids",
  "party",
  "please",
  "theme",
  "the",
  "with",
]);

export const FACILITY_INVITATION_THEME_CATALOG: readonly FacilityInvitationThemeCatalogEntry[] =
  [
    {
      id: "sonic",
      label: "Sonic Party",
      aliases: ["sonic", "sonic the hedgehog", "hedgehog", "sonic hedgehog"],
      category: "game",
      accent: "#1d4ed8",
      secondary: "#facc15",
      background: "#eff6ff",
      border: "#93c5fd",
      graphicLabel: "Sonic",
      graphicVariant: "game",
      approvedArtworkSlot: "sonic",
    },
    {
      id: "mario",
      label: "Mario Party",
      aliases: ["mario", "super mario", "luigi", "nintendo mario"],
      category: "game",
      accent: "#dc2626",
      secondary: "#16a34a",
      background: "#fef2f2",
      border: "#fecaca",
      graphicLabel: "Mario",
      graphicVariant: "game",
      approvedArtworkSlot: "mario",
    },
    {
      id: "minecraft",
      label: "Minecraft Party",
      aliases: ["minecraft", "mine craft", "creeper", "blocks", "block game"],
      category: "game",
      accent: "#16a34a",
      secondary: "#78350f",
      background: "#f0fdf4",
      border: "#86efac",
      graphicLabel: "Minecraft",
      graphicVariant: "blocks",
      approvedArtworkSlot: "minecraft",
    },
    {
      id: "pokemon",
      label: "Pokemon Party",
      aliases: ["pokemon", "pokémon", "pikachu", "poke mon"],
      category: "game",
      accent: "#2563eb",
      secondary: "#facc15",
      background: "#eff6ff",
      border: "#bfdbfe",
      graphicLabel: "Pokemon",
      graphicVariant: "game",
      approvedArtworkSlot: "pokemon",
    },
    {
      id: "roblox",
      label: "Roblox Party",
      aliases: ["roblox", "roblocks", "road blocks"],
      category: "game",
      accent: "#dc2626",
      secondary: "#111827",
      background: "#f8fafc",
      border: "#cbd5e1",
      graphicLabel: "Roblox",
      graphicVariant: "blocks",
      approvedArtworkSlot: "roblox",
    },
    {
      id: "fortnite",
      label: "Fortnite Party",
      aliases: ["fortnite", "fort night"],
      category: "game",
      accent: "#7c3aed",
      secondary: "#06b6d4",
      background: "#f5f3ff",
      border: "#ddd6fe",
      graphicLabel: "Fortnite",
      graphicVariant: "game",
      approvedArtworkSlot: "fortnite",
    },
    {
      id: "paw-patrol",
      label: "Paw Patrol Party",
      aliases: ["paw patrol", "pawpatrol", "chase", "skye", "marshall pups"],
      category: "tv",
      accent: "#dc2626",
      secondary: "#2563eb",
      background: "#eff6ff",
      border: "#bfdbfe",
      graphicLabel: "Paw Patrol",
      graphicVariant: "animal",
      approvedArtworkSlot: "paw-patrol",
    },
    {
      id: "bluey",
      label: "Bluey Party",
      aliases: ["bluey", "bingo", "bluey and bingo"],
      category: "tv",
      accent: "#0284c7",
      secondary: "#f59e0b",
      background: "#f0f9ff",
      border: "#bae6fd",
      graphicLabel: "Bluey",
      graphicVariant: "cartoon",
      approvedArtworkSlot: "bluey",
    },
    {
      id: "cocomelon",
      label: "Cocomelon Party",
      aliases: ["cocomelon", "coco melon", "jj cocomelon"],
      category: "tv",
      accent: "#16a34a",
      secondary: "#ef4444",
      background: "#f0fdf4",
      border: "#bbf7d0",
      graphicLabel: "Cocomelon",
      graphicVariant: "cartoon",
      approvedArtworkSlot: "cocomelon",
    },
    {
      id: "mickey",
      label: "Mickey Mouse Party",
      aliases: ["mickey", "mickey mouse", "minnie", "minnie mouse", "mouse"],
      category: "character",
      accent: "#dc2626",
      secondary: "#111827",
      background: "#fef2f2",
      border: "#fecaca",
      graphicLabel: "Mickey",
      graphicVariant: "cartoon",
      approvedArtworkSlot: "mickey",
    },
    {
      id: "barbie",
      label: "Barbie Party",
      aliases: ["barbie", "barby", "fashion doll"],
      category: "character",
      accent: "#db2777",
      secondary: "#f472b6",
      background: "#fdf2f8",
      border: "#fbcfe8",
      graphicLabel: "Barbie",
      graphicVariant: "fashion",
      approvedArtworkSlot: "barbie",
    },
    {
      id: "frozen",
      label: "Frozen Party",
      aliases: ["frozen", "elsa", "anna", "olaf", "ice princess"],
      category: "movie",
      accent: "#0284c7",
      secondary: "#a78bfa",
      background: "#f0f9ff",
      border: "#bae6fd",
      graphicLabel: "Frozen",
      graphicVariant: "princess",
      approvedArtworkSlot: "frozen",
    },
    {
      id: "spider-hero",
      label: "Spider Hero Party",
      aliases: ["spiderman", "spider man", "spider-man", "spidey", "spider hero"],
      category: "character",
      accent: "#dc2626",
      secondary: "#2563eb",
      background: "#eff6ff",
      border: "#bfdbfe",
      graphicLabel: "Spider Hero",
      graphicVariant: "superhero",
      approvedArtworkSlot: "spider-hero",
    },
    {
      id: "bat-hero",
      label: "Batman Party",
      aliases: ["batman", "bat man", "bat hero"],
      category: "character",
      accent: "#111827",
      secondary: "#facc15",
      background: "#f8fafc",
      border: "#cbd5e1",
      graphicLabel: "Batman",
      graphicVariant: "superhero",
      approvedArtworkSlot: "bat-hero",
    },
    {
      id: "superhero",
      label: "Superhero Party",
      aliases: ["superhero", "super hero", "hero", "marvel", "avengers"],
      category: "classic",
      accent: "#dc2626",
      secondary: "#2563eb",
      background: "#eff6ff",
      border: "#bfdbfe",
      graphicLabel: "Hero",
      graphicVariant: "superhero",
      approvedArtworkSlot: "superhero",
    },
    {
      id: "princess",
      label: "Princess Party",
      aliases: ["princess", "royal", "fairy tale", "fairytale", "castle"],
      category: "classic",
      accent: "#db2777",
      secondary: "#7c3aed",
      background: "#fdf2f8",
      border: "#fbcfe8",
      graphicLabel: "Princess",
      graphicVariant: "princess",
      approvedArtworkSlot: "princess",
    },
    {
      id: "unicorn",
      label: "Unicorn Party",
      aliases: ["unicorn", "rainbow unicorn", "rainbow"],
      category: "classic",
      accent: "#c026d3",
      secondary: "#f59e0b",
      background: "#fdf4ff",
      border: "#f5d0fe",
      graphicLabel: "Unicorn",
      graphicVariant: "princess",
      approvedArtworkSlot: "unicorn",
    },
    {
      id: "mermaid",
      label: "Mermaid Party",
      aliases: ["mermaid", "little mermaid", "under the sea", "ocean"],
      category: "classic",
      accent: "#0891b2",
      secondary: "#db2777",
      background: "#ecfeff",
      border: "#a5f3fc",
      graphicLabel: "Mermaid",
      graphicVariant: "water",
      approvedArtworkSlot: "mermaid",
    },
    {
      id: "dinosaur",
      label: "Dinosaur Party",
      aliases: ["dinosaur", "dinosaurs", "dino", "jurassic", "t rex", "trex"],
      category: "classic",
      accent: "#65a30d",
      secondary: "#ea580c",
      background: "#f7fee7",
      border: "#d9f99d",
      graphicLabel: "Dino",
      graphicVariant: "dinosaur",
      approvedArtworkSlot: "dinosaur",
    },
    {
      id: "cars",
      label: "Race Car Party",
      aliases: ["cars", "race car", "racecar", "hot wheels", "monster truck"],
      category: "classic",
      accent: "#dc2626",
      secondary: "#facc15",
      background: "#fef2f2",
      border: "#fecaca",
      graphicLabel: "Racing",
      graphicVariant: "racing",
      approvedArtworkSlot: "racing",
    },
    {
      id: "space",
      label: "Space Party",
      aliases: ["space", "astronaut", "rocket", "outer space", "planet"],
      category: "classic",
      accent: "#4f46e5",
      secondary: "#06b6d4",
      background: "#eef2ff",
      border: "#c7d2fe",
      graphicLabel: "Space",
      graphicVariant: "space",
      approvedArtworkSlot: "space",
    },
    {
      id: "glow",
      label: "Glow Party",
      aliases: ["glow", "neon", "dance", "disco"],
      category: "classic",
      accent: "#a21caf",
      secondary: "#06b6d4",
      background: "#fdf4ff",
      border: "#f5d0fe",
      graphicLabel: "Glow",
      graphicVariant: "glow",
      approvedArtworkSlot: "glow",
    },
    {
      id: "clemson",
      label: "Clemson Football Party",
      aliases: ["clemson", "clemson football", "tigers", "clemson tigers"],
      category: "team",
      accent: "#f56600",
      secondary: "#522d80",
      background: "#fff7ed",
      border: "#fed7aa",
      graphicLabel: "Clemson",
      graphicVariant: "sports",
      approvedArtworkSlot: "clemson",
    },
    {
      id: "gamecocks",
      label: "Gamecocks Football Party",
      aliases: ["gamecocks", "gamecock", "usc", "south carolina football"],
      category: "team",
      accent: "#73000a",
      secondary: "#111827",
      background: "#fff1f2",
      border: "#fecdd3",
      graphicLabel: "Gamecocks",
      graphicVariant: "sports",
      approvedArtworkSlot: "gamecocks",
    },
    {
      id: "sports",
      label: "Sports Party",
      aliases: ["sports", "football", "basketball", "baseball", "soccer", "game day"],
      category: "sports",
      accent: "#16a34a",
      secondary: "#2563eb",
      background: "#f0fdf4",
      border: "#bbf7d0",
      graphicLabel: "Game Day",
      graphicVariant: "sports",
      approvedArtworkSlot: "sports",
    },
  ];

export const DEFAULT_INVITATION_THEME: FacilityInvitationThemeCatalogEntry = {
  id: "birthday",
  label: "Birthday Party",
  aliases: ["birthday", "party"],
  category: "fallback",
  accent: "#f97316",
  secondary: "#0891b2",
  background: "#fff7ed",
  border: "#fed7aa",
  graphicLabel: "Party",
  graphicVariant: "party",
  approvedArtworkSlot: null,
};

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((token) => token && !COMMON_WORDS.has(token));
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let last = i - 1;
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const old = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        last + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      last = old;
    }
  }
  return previous[right.length] ?? 0;
}

function tokenSimilarity(left: string, right: string): number {
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) {
    return Math.min(left.length, right.length) / Math.max(left.length, right.length);
  }
  const longest = Math.max(left.length, right.length);
  if (longest < 4) return 0;
  return 1 - editDistance(left, right) / longest;
}

function aliasScore(input: string, alias: string): number {
  const normalizedInput = normalize(input);
  const normalizedAlias = normalize(alias);
  if (!normalizedInput || !normalizedAlias) return 0;
  if (normalizedInput === normalizedAlias) return 1;
  if (normalizedInput.includes(normalizedAlias)) return 0.96;

  const inputTokens = tokens(normalizedInput);
  const aliasTokens = tokens(normalizedAlias);
  if (aliasTokens.length === 0 || inputTokens.length === 0) return 0;

  const perToken = aliasTokens.map((aliasToken) =>
    Math.max(
      ...inputTokens.map((inputToken) => tokenSimilarity(inputToken, aliasToken)),
      0,
    ),
  );
  const average =
    perToken.reduce((sum, score) => sum + score, 0) / aliasTokens.length;
  const strongMatches = perToken.filter((score) => score >= 0.78).length;
  const coverage = strongMatches / aliasTokens.length;
  return average * 0.72 + coverage * 0.28;
}

export function normalizeInvitationThemeText(value: string | null | undefined) {
  return normalize(value ?? "");
}

export function matchInvitationTheme(
  value: string | null | undefined,
): FacilityInvitationThemeCatalogEntry {
  const input = normalizeInvitationThemeText(value);
  if (!input) return DEFAULT_INVITATION_THEME;

  let best:
    | { entry: FacilityInvitationThemeCatalogEntry; score: number }
    | null = null;
  for (const entry of FACILITY_INVITATION_THEME_CATALOG) {
    const score = Math.max(
      aliasScore(input, entry.label),
      ...entry.aliases.map((alias) => aliasScore(input, alias)),
    );
    if (!best || score > best.score) {
      best = { entry, score };
    }
  }

  if (best && best.score >= 0.72) return best.entry;

  const inputTokens = tokens(input);
  if (inputTokens.some((token) => ["football", "basketball", "baseball", "soccer"].includes(token))) {
    return FACILITY_INVITATION_THEME_CATALOG.find((entry) => entry.id === "sports") ?? DEFAULT_INVITATION_THEME;
  }
  if (inputTokens.some((token) => ["game", "gamer", "gaming", "video"].includes(token))) {
    return FACILITY_INVITATION_THEME_CATALOG.find((entry) => entry.id === "minecraft") ?? DEFAULT_INVITATION_THEME;
  }
  if (inputTokens.some((token) => ["princess", "fairy", "castle", "royal"].includes(token))) {
    return FACILITY_INVITATION_THEME_CATALOG.find((entry) => entry.id === "princess") ?? DEFAULT_INVITATION_THEME;
  }
  if (inputTokens.some((token) => ["hero", "superhero", "super"].includes(token))) {
    return FACILITY_INVITATION_THEME_CATALOG.find((entry) => entry.id === "superhero") ?? DEFAULT_INVITATION_THEME;
  }

  return {
    ...DEFAULT_INVITATION_THEME,
    id: "custom",
    label: value?.trim().replace(/\s+/g, " ") || DEFAULT_INVITATION_THEME.label,
    graphicLabel:
      value?.trim().replace(/\s+/g, " ").slice(0, 18) ||
      DEFAULT_INVITATION_THEME.graphicLabel,
  };
}
