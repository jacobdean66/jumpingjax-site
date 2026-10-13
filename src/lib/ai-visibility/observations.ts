import { z } from "zod";

export const MAX_IMPORT_BYTES = 2_000_000;
export const MAX_OBSERVATIONS = 1000;
export const RESULT_TYPES = ["ai-answer", "web-search", "simulated"] as const;
export const SERVICE_TYPES = ["rental", "facility", "open-play"] as const;
export const TARGET_CITIES = [
  "Greenwood",
  "Abbeville",
  "Ninety Six",
  "Hodges",
  "Ware Shoals",
  "Laurens",
] as const;

const text = (max: number) => z.string().trim().min(1).max(max);
const sourceUrl = text(2000).refine((value) => {
  try {
    const url = new URL(value);
    return (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}, "Use an HTTP(S) URL without credentials");
const source = z.object({ title: text(200), url: sourceUrl }).strict();

export const observationSchema = z
  .object({
    id: text(120),
    capturedAt: z.iso.datetime({ offset: true }),
    resultType: z.enum(RESULT_TYPES),
    provider: text(160),
    collectionMethod: z.enum(["manual", "web-search-tool"]),
    query: text(1000),
    city: text(120),
    serviceType: z.enum(SERVICE_TYPES),
    locationContext: text(1000),
    sessionContext: text(1000),
    mentioned: z.boolean(),
    recommended: z.boolean().nullable(),
    ordered: z.boolean(),
    position: z.number().int().min(1).max(100).nullable(),
    competitors: z
      .array(z.object({ name: text(200), url: sourceUrl.optional() }).strict())
      .max(50),
    sources: z.array(source).max(50),
    evidence: z
      .object({ text: text(60000), url: sourceUrl.optional() })
      .strict(),
    notes: z.string().trim().max(3000),
  })
  .strict()
  .superRefine((row, ctx) => {
    const invalid = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (row.resultType !== "ai-answer" && row.recommended !== null)
      invalid(
        "recommended",
        "Only actual AI answers can measure recommendations",
      );
    if (
      row.resultType !== "ai-answer" &&
      (row.position !== null || row.ordered)
    )
      invalid(
        "position",
        "Web results and simulations do not establish an AI order",
      );
    if (row.recommended === true && !row.mentioned)
      invalid("recommended", "A recommendation must also mention the business");
    if (row.position !== null && (!row.mentioned || !row.ordered))
      invalid(
        "position",
        "Position requires a mention in an explicitly ordered answer",
      );
    if (row.resultType === "ai-answer" && row.collectionMethod !== "manual")
      invalid("collectionMethod", "Web-search tool output is not an AI answer");
  });

export type Observation = z.infer<typeof observationSchema>;
export type ResultType = Observation["resultType"];
export const importSchema = z
  .object({
    version: z.literal(1),
    observations: z.array(observationSchema).max(MAX_OBSERVATIONS),
  })
  .strict();

export function parseObservationImport(input: string): Observation[] {
  if (new TextEncoder().encode(input).length > MAX_IMPORT_BYTES)
    throw new Error("Import exceeds 2 MB");
  const parsed = importSchema.safeParse(JSON.parse(input));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(
      `Invalid import at ${issue.path.join(".") || "root"}: ${issue.message}`,
    );
  }
  const seen = new Set<string>();
  for (const row of parsed.data.observations) {
    if (seen.has(row.id))
      throw new Error(`Duplicate observation id: ${row.id}`);
    seen.add(row.id);
    if (Date.parse(row.capturedAt) > Date.now() + 300_000)
      throw new Error(`Observation ${row.id} has a future timestamp`);
  }
  return parsed.data.observations;
}

export function mergeObservations(
  current: readonly Observation[],
  incoming: readonly Observation[],
): Observation[] {
  const byId = new Map(current.map((row) => [row.id, row]));
  for (const row of incoming) {
    const existing = byId.get(row.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(row))
      throw new Error(
        `Conflicting evidence for id ${row.id}; use a new id for a new sample`,
      );
    byId.set(row.id, row);
  }
  if (byId.size > MAX_OBSERVATIONS)
    throw new Error(
      `Keep exports to ${MAX_OBSERVATIONS} observations or fewer`,
    );
  return [...byId.values()].sort((a, b) =>
    b.capturedAt.localeCompare(a.capturedAt),
  );
}

export function summarizeObservations(rows: readonly Observation[]) {
  const ai = rows.filter((row) => row.resultType === "ai-answer");
  const evaluated = ai.filter((row) => row.recommended !== null);
  return {
    samples: rows.length,
    mentions: rows.filter((row) => row.mentioned).length,
    aiSamples: ai.length,
    recommendationEvaluations: evaluated.length,
    recommendations: evaluated.filter((row) => row.recommended).length,
    recommendationRate: evaluated.length
      ? evaluated.filter((row) => row.recommended).length / evaluated.length
      : null,
  };
}

export function groupObservations(
  rows: readonly Observation[],
  key: (row: Observation) => string,
) {
  const groups = new Map<string, Observation[]>();
  for (const row of rows) {
    const name = key(row);
    groups.set(name, [...(groups.get(name) ?? []), row]);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, observations]) => ({
      name,
      ...summarizeObservations(observations),
    }));
}

export function competitorAppearances(rows: readonly Observation[]) {
  const counts = new Map<
    string,
    { name: string; url?: string; appearances: number }
  >();
  for (const row of rows) {
    const seen = new Set<string>();
    for (const competitor of row.competitors) {
      const key = competitor.name.toLocaleLowerCase("en-US");
      if (seen.has(key)) continue;
      seen.add(key);
      const previous = counts.get(key);
      counts.set(key, {
        ...competitor,
        url: competitor.url ?? previous?.url,
        appearances: (previous?.appearances ?? 0) + 1,
      });
    }
  }
  return [...counts.values()].sort(
    (a, b) => b.appearances - a.appearances || a.name.localeCompare(b.name),
  );
}

export const QUERY_PLAN = TARGET_CITIES.flatMap((city) => [
  {
    city,
    serviceType: "rental" as const,
    query: `Who rents bounce houses for birthday parties in ${city}, South Carolina?`,
  },
  {
    city,
    serviceType: "rental" as const,
    query: `Which companies deliver inflatable water slides to ${city}, SC for a school or church event?`,
  },
  {
    city,
    serviceType: "facility" as const,
    query: `Where can I host an indoor children's birthday party near ${city}, SC? Compare venues around Greenwood.`,
  },
]);
