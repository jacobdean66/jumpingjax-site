/**
 * Birthday invitation themes are customer-entered text and should be
 * interpreted as common kids TV/game/movie/team/character themes using
 * fuzzy matching and safe approved artwork lookup.
 *
 * Expand this catalog over time. Do not add copyrighted character artwork
 * here — register approved files in `approved-artwork.ts` by theme ID.
 */

export const INVITATION_STYLE_FAMILIES = [
  "birthday",
  "sports",
  "princess",
  "gamer",
  "superhero",
  "animal",
  "colorful",
] as const;

export type InvitationStyleFamily = (typeof INVITATION_STYLE_FAMILIES)[number];

export type InvitationArtworkKind = "approved" | "inspired" | "generic";

export type InvitationThemeDefinition = {
  id: string;
  label: string;
  family: InvitationStyleFamily;
  /** Lowercase phrases customers actually type. */
  aliases: string[];
  artworkSlot: string;
  palette: {
    background: string;
    backgroundAlt: string;
    accent: string;
    accent2: string;
    text: string;
    muted: string;
  };
};

export const FALLBACK_THEME_IDS = {
  birthday: "generic-birthday",
  sports: "generic-sports",
  princess: "princess",
  gamer: "generic-gamer",
  superhero: "generic-superhero",
  animal: "generic-animal",
  colorful: "generic-colorful",
} as const satisfies Record<InvitationStyleFamily, string>;

export const INVITATION_THEMES: InvitationThemeDefinition[] = [
  {
    id: "sonic",
    label: "Speed Stars",
    family: "gamer",
    aliases: [
      "sonic",
      "sonic the hedgehog",
      "sonic hedgehog",
      "sonic party",
      "sonics",
      "sonnic",
    ],
    artworkSlot: "sonic",
    palette: {
      background: "#0b3d91",
      backgroundAlt: "#1d4ed8",
      accent: "#f59e0b",
      accent2: "#ef4444",
      text: "#ffffff",
      muted: "#dbeafe",
    },
  },
  {
    id: "mario",
    label: "Classic Platformer",
    family: "gamer",
    aliases: [
      "mario",
      "super mario",
      "mario kart",
      "mario party",
      "luigi",
      "nintendo mario",
    ],
    artworkSlot: "mario",
    palette: {
      background: "#dc2626",
      backgroundAlt: "#b91c1c",
      accent: "#2563eb",
      accent2: "#fbbf24",
      text: "#ffffff",
      muted: "#fee2e2",
    },
  },
  {
    id: "minecraft",
    label: "Block Builders",
    family: "gamer",
    aliases: [
      "minecraft",
      "mine craft",
      "minecraft party",
      "minecrafter",
      "minecraf",
      "creeper",
    ],
    artworkSlot: "minecraft",
    palette: {
      background: "#14532d",
      backgroundAlt: "#166534",
      accent: "#65a30d",
      accent2: "#a3e635",
      text: "#ecfccb",
      muted: "#d9f99d",
    },
  },
  {
    id: "pokemon",
    label: "Pocket Adventure",
    family: "gamer",
    aliases: [
      "pokemon",
      "pokémon",
      "poke mon",
      "pikachu",
      "pokemon party",
    ],
    artworkSlot: "pokemon",
    palette: {
      background: "#1e3a8a",
      backgroundAlt: "#facc15",
      accent: "#ef4444",
      accent2: "#f8fafc",
      text: "#0f172a",
      muted: "#1e293b",
    },
  },
  {
    id: "barbie",
    label: "Glam Pink",
    family: "colorful",
    aliases: ["barbie", "barbie party", "barbi", "malibu barbie"],
    artworkSlot: "barbie",
    palette: {
      background: "#f9a8d4",
      backgroundAlt: "#ec4899",
      accent: "#ffffff",
      accent2: "#be185d",
      text: "#831843",
      muted: "#9d174d",
    },
  },
  {
    id: "paw-patrol",
    label: "Rescue Pups",
    family: "animal",
    aliases: [
      "paw patrol",
      "pawpatrol",
      "paw patrol theme",
      "paw patrol party",
      "pups",
      "ryder",
    ],
    artworkSlot: "paw-patrol",
    palette: {
      background: "#0369a1",
      backgroundAlt: "#f97316",
      accent: "#facc15",
      accent2: "#ef4444",
      text: "#ffffff",
      muted: "#e0f2fe",
    },
  },
  {
    id: "bluey",
    label: "Playful Pups",
    family: "animal",
    aliases: ["bluey", "bluey party", "bingo heeler", "heeler"],
    artworkSlot: "bluey",
    palette: {
      background: "#38bdf8",
      backgroundAlt: "#f97316",
      accent: "#ffffff",
      accent2: "#7c3aed",
      text: "#0f172a",
      muted: "#1e3a5f",
    },
  },
  {
    id: "spider-man",
    label: "Web Hero",
    family: "superhero",
    aliases: [
      "spider man",
      "spiderman",
      "spider-man",
      "spidey",
      "web slinger",
    ],
    artworkSlot: "spider-man",
    palette: {
      background: "#b91c1c",
      backgroundAlt: "#1e3a8a",
      accent: "#f8fafc",
      accent2: "#0f172a",
      text: "#ffffff",
      muted: "#fecaca",
    },
  },
  {
    id: "batman",
    label: "Night Hero",
    family: "superhero",
    aliases: ["batman", "bat man", "dark knight", "gotham"],
    artworkSlot: "batman",
    palette: {
      background: "#0f172a",
      backgroundAlt: "#1e293b",
      accent: "#facc15",
      accent2: "#64748b",
      text: "#f8fafc",
      muted: "#cbd5e1",
    },
  },
  {
    id: "princess",
    label: "Princess Party",
    family: "princess",
    aliases: ["princess", "princesses", "royal princess", "castle princess"],
    artworkSlot: "princess",
    palette: {
      background: "#fce7f3",
      backgroundAlt: "#c4b5fd",
      accent: "#db2777",
      accent2: "#fbbf24",
      text: "#831843",
      muted: "#9d174d",
    },
  },
  {
    id: "mermaid",
    label: "Mermaid Tide",
    family: "princess",
    aliases: ["mermaid", "mermaids", "under the sea", "ariel"],
    artworkSlot: "mermaid",
    palette: {
      background: "#0e7490",
      backgroundAlt: "#14b8a6",
      accent: "#f472b6",
      accent2: "#fde68a",
      text: "#ecfeff",
      muted: "#a5f3fc",
    },
  },
  {
    id: "unicorn",
    label: "Unicorn Magic",
    family: "colorful",
    aliases: ["unicorn", "unicorns", "unicorn party"],
    artworkSlot: "unicorn",
    palette: {
      background: "#fae8ff",
      backgroundAlt: "#ddd6fe",
      accent: "#e879f9",
      accent2: "#67e8f9",
      text: "#6b21a8",
      muted: "#7e22ce",
    },
  },
  {
    id: "dinosaurs",
    label: "Dino Adventure",
    family: "animal",
    aliases: ["dinosaur", "dinosaurs", "dino", "dinos", "t rex", "trex"],
    artworkSlot: "dinosaurs",
    palette: {
      background: "#365314",
      backgroundAlt: "#4d7c0f",
      accent: "#a3e635",
      accent2: "#f97316",
      text: "#ecfccb",
      muted: "#d9f99d",
    },
  },
  {
    id: "clemson",
    label: "Clemson Football",
    family: "sports",
    aliases: [
      "clemson",
      "clemson football",
      "clemson tigers",
      "tigers football",
      "death valley",
    ],
    artworkSlot: "clemson",
    palette: {
      background: "#F56600",
      backgroundAlt: "#522D80",
      accent: "#ffffff",
      accent2: "#522D80",
      text: "#ffffff",
      muted: "#ffedd5",
    },
  },
  {
    id: "gamecocks",
    label: "Gamecock Football",
    family: "sports",
    aliases: [
      "gamecock",
      "gamecocks",
      "gamecock football",
      "carolina gamecocks",
      "usc gamecocks",
      "south carolina football",
    ],
    artworkSlot: "gamecocks",
    palette: {
      background: "#73000A",
      backgroundAlt: "#000000",
      accent: "#ffffff",
      accent2: "#a3a3a3",
      text: "#ffffff",
      muted: "#fecaca",
    },
  },
  {
    id: "generic-sports",
    label: "Sports Party",
    family: "sports",
    aliases: [
      "football",
      "football team",
      "soccer",
      "baseball",
      "basketball",
      "sports",
      "sports team",
    ],
    artworkSlot: "generic-sports",
    palette: {
      background: "#14532d",
      backgroundAlt: "#1e3a8a",
      accent: "#facc15",
      accent2: "#f8fafc",
      text: "#ffffff",
      muted: "#dcfce7",
    },
  },
  {
    id: "generic-gamer",
    label: "Gamer Party",
    family: "gamer",
    aliases: [
      "gamer",
      "gaming",
      "video game",
      "videogame",
      "xbox",
      "playstation",
      "nintendo",
    ],
    artworkSlot: "generic-gamer",
    palette: {
      background: "#111827",
      backgroundAlt: "#312e81",
      accent: "#22d3ee",
      accent2: "#a3e635",
      text: "#f8fafc",
      muted: "#c7d2fe",
    },
  },
  {
    id: "generic-superhero",
    label: "Superhero Party",
    family: "superhero",
    aliases: ["superhero", "super hero", "superheroes", "marvel", "dc comics"],
    artworkSlot: "generic-superhero",
    palette: {
      background: "#1e3a8a",
      backgroundAlt: "#b91c1c",
      accent: "#facc15",
      accent2: "#ffffff",
      text: "#ffffff",
      muted: "#dbeafe",
    },
  },
  {
    id: "generic-animal",
    label: "Animal Party",
    family: "animal",
    aliases: ["animal", "animals", "zoo", "jungle", "puppy", "kitten", "safari"],
    artworkSlot: "generic-animal",
    palette: {
      background: "#92400e",
      backgroundAlt: "#166534",
      accent: "#fde68a",
      accent2: "#86efac",
      text: "#fffbeb",
      muted: "#fef3c7",
    },
  },
  {
    id: "generic-colorful",
    label: "Colorful Party",
    family: "colorful",
    aliases: ["rainbow", "neon", "glow", "colorful", "confetti", "sparkle"],
    artworkSlot: "generic-colorful",
    palette: {
      background: "#7c3aed",
      backgroundAlt: "#db2777",
      accent: "#facc15",
      accent2: "#22d3ee",
      text: "#ffffff",
      muted: "#fce7f3",
    },
  },
  {
    id: "generic-birthday",
    label: "Birthday Party",
    family: "birthday",
    aliases: ["birthday", "bday", "generic", "none"],
    artworkSlot: "generic-birthday",
    palette: {
      background: "#f97316",
      backgroundAlt: "#ec4899",
      accent: "#fde68a",
      accent2: "#67e8f9",
      text: "#ffffff",
      muted: "#ffedd5",
    },
  },
];

export const THEME_BY_ID = new Map(
  INVITATION_THEMES.map((theme) => [theme.id, theme]),
);

export function getInvitationTheme(id: string): InvitationThemeDefinition {
  return THEME_BY_ID.get(id) ?? THEME_BY_ID.get("generic-birthday")!;
}
