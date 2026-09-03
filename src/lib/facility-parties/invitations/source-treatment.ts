import { normalizeThemeText } from "./match-theme";

export type InvitationSourceTreatmentId =
  | "speedster-blue"
  | "mushroom-kingdom"
  | "block-world"
  | "camouflage"
  | "web-hero"
  | "night-hero"
  | "electric-creatures"
  | "pink-fashion"
  | "rescue-pups"
  | "blue-pup";

export type InvitationSourceTreatment = Readonly<{
  id: InvitationSourceTreatmentId;
  aliases: readonly string[];
  background: string;
  backgroundAlt: string;
  accent: string;
  accent2: string;
  text: string;
  muted: string;
  border: string;
}>;

const SOURCE_TREATMENTS: readonly InvitationSourceTreatment[] = [
  {
    id: "speedster-blue",
    aliases: ["sonic", "sonnic"],
    background: "#0647b8",
    backgroundAlt: "#03163f",
    accent: "#ffd21f",
    accent2: "#27c8ff",
    text: "#ffffff",
    muted: "#d9f4ff",
    border: "#23c9ff",
  },
  {
    id: "mushroom-kingdom",
    aliases: ["super mario", "mario", "luigi"],
    background: "#2b8fe8",
    backgroundAlt: "#07366e",
    accent: "#f23434",
    accent2: "#ffd436",
    text: "#ffffff",
    muted: "#e6f5ff",
    border: "#ffd436",
  },
  {
    id: "block-world",
    aliases: ["minecraft", "mine craft", "creeper"],
    background: "#397529",
    backgroundAlt: "#142f16",
    accent: "#77c34f",
    accent2: "#8b5a2b",
    text: "#ffffff",
    muted: "#e2f5d7",
    border: "#82cf55",
  },
  {
    id: "camouflage",
    aliases: ["camouflage", "camoflauge", "camo"],
    background: "#f4efdb",
    backgroundAlt: "#d8d7a8",
    accent: "#66763a",
    accent2: "#a58b54",
    text: "#182114",
    muted: "#4f5b3b",
    border: "#66763a",
  },
  {
    id: "web-hero",
    aliases: ["spider man", "spiderman", "spider-man", "spidey"],
    background: "#b6172b",
    backgroundAlt: "#31050d",
    accent: "#ffffff",
    accent2: "#1677d2",
    text: "#ffffff",
    muted: "#ffe2e6",
    border: "#58a9ff",
  },
  {
    id: "night-hero",
    aliases: ["batman", "bat man"],
    background: "#202733",
    backgroundAlt: "#050608",
    accent: "#f7d21e",
    accent2: "#7d8796",
    text: "#ffffff",
    muted: "#d7dbe2",
    border: "#f7d21e",
  },
  {
    id: "electric-creatures",
    aliases: ["pokemon", "pokémon", "pikachu"],
    background: "#1663ae",
    backgroundAlt: "#08274c",
    accent: "#ffdc28",
    accent2: "#ed3348",
    text: "#ffffff",
    muted: "#e4f4ff",
    border: "#ffdc28",
  },
  {
    id: "pink-fashion",
    aliases: ["barbie", "fashion doll"],
    background: "#ec4899",
    backgroundAlt: "#79164c",
    accent: "#ffffff",
    accent2: "#ffd1eb",
    text: "#ffffff",
    muted: "#fff0f8",
    border: "#ffd1eb",
  },
  {
    id: "rescue-pups",
    aliases: ["paw patrol", "paw-patrol"],
    background: "#1476c7",
    backgroundAlt: "#082e5b",
    accent: "#e52c3b",
    accent2: "#ffd33d",
    text: "#ffffff",
    muted: "#e1f2ff",
    border: "#ffd33d",
  },
  {
    id: "blue-pup",
    aliases: ["bluey", "blue heeler"],
    background: "#4b9ecb",
    backgroundAlt: "#17496d",
    accent: "#f6a94a",
    accent2: "#b8e3f7",
    text: "#ffffff",
    muted: "#ecf9ff",
    border: "#f6c06d",
  },
] as const;

function includesAlias(normalizedSource: string, alias: string): boolean {
  const normalizedAlias = normalizeThemeText(alias);
  return (
    normalizedSource === normalizedAlias ||
    ` ${normalizedSource} `.includes(` ${normalizedAlias} `)
  );
}

export function resolveInvitationSourceTreatment(
  sourceText: string,
): InvitationSourceTreatment | null {
  const normalized = normalizeThemeText(sourceText);
  if (!normalized) return null;
  return (
    SOURCE_TREATMENTS.find((treatment) =>
      treatment.aliases.some((alias) => includesAlias(normalized, alias)),
    ) ?? null
  );
}
