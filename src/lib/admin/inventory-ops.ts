import type { RentalCategoryId } from "@/data/rentals";

export const BLOWER_HORSEPOWERS = ["1", "1.5", "2", "3"] as const;
export type BlowerHorsepower = (typeof BLOWER_HORSEPOWERS)[number];

export type BlowerRequirement = {
  horsepower: BlowerHorsepower;
  quantity: number;
};

export const CLEANING_SUPPLY_VALUES = ["slide-spray", "disinfectant"] as const;
export type CleaningSupply = (typeof CLEANING_SUPPLY_VALUES)[number];

export const DIMENSION_UNITS = ["ft", "in", "m"] as const;
export type DimensionUnit = (typeof DIMENSION_UNITS)[number];

export const DIMENSION_CONFIDENCE_VALUES = [
  "verified",
  "high",
  "medium",
  "unresolved",
] as const;
export type DimensionConfidence = (typeof DIMENSION_CONFIDENCE_VALUES)[number];

export type InventoryDimensions = {
  lengthFt: number | null;
  widthFt: number | null;
  heightFt: number | null;
  unit: DimensionUnit;
  sourceText: string;
  sourceUrl: string;
  manufacturer: string;
  confidence: DimensionConfidence | null;
  researchNotes: string;
};

export type InventoryOperationalFields = {
  blowerRequirements: BlowerRequirement[];
  tarpRequirement: string;
  cleaningSupply: CleaningSupply;
  cleaningSupplyExplicit: boolean;
  dimensions: InventoryDimensions;
};

export type InventoryOpsRow = {
  category_id?: string | null;
  blower_requirements?: unknown;
  tarp_requirement?: string | null;
  cleaning_supply?: string | null;
  length_ft?: number | string | null;
  width_ft?: number | string | null;
  height_ft?: number | string | null;
  dimension_unit?: string | null;
  dimension_source_text?: string | null;
  dimension_source_url?: string | null;
  dimension_manufacturer?: string | null;
  dimension_confidence?: string | null;
  dimension_research_notes?: string | null;
};

export type InventoryOpsDbPayload = {
  blower_requirements: BlowerRequirement[];
  tarp_requirement: string;
  cleaning_supply: CleaningSupply;
  length_ft: number | null;
  width_ft: number | null;
  height_ft: number | null;
  dimension_unit: DimensionUnit;
  dimension_source_text: string;
  dimension_source_url: string;
  dimension_manufacturer: string;
  dimension_confidence: DimensionConfidence | null;
  dimension_research_notes: string;
};

const SLIDE_SPRAY_CATEGORIES = new Set<RentalCategoryId>([
  "slides",
  "water-slides",
  "combos",
]);

const CLEANING_LABELS: Record<CleaningSupply, string> = {
  "slide-spray": "Slide spray",
  disinfectant: "Disinfectant",
};

function cleanText(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function isBlowerHorsepower(value: unknown): value is BlowerHorsepower {
  return (
    typeof value === "string" &&
    (BLOWER_HORSEPOWERS as readonly string[]).includes(value)
  );
}

function isCleaningSupply(value: unknown): value is CleaningSupply {
  return (
    typeof value === "string" &&
    (CLEANING_SUPPLY_VALUES as readonly string[]).includes(value)
  );
}

function isDimensionUnit(value: unknown): value is DimensionUnit {
  return (
    typeof value === "string" &&
    (DIMENSION_UNITS as readonly string[]).includes(value)
  );
}

function isDimensionConfidence(value: unknown): value is DimensionConfidence {
  return (
    typeof value === "string" &&
    (DIMENSION_CONFIDENCE_VALUES as readonly string[]).includes(value)
  );
}

/** Positive finite number, or null for unknown. Never treats 0 as a dimension. */
export function parsePositiveDimension(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function defaultCleaningSupply(
  categoryId: RentalCategoryId | string,
): CleaningSupply {
  if (SLIDE_SPRAY_CATEGORIES.has(categoryId as RentalCategoryId)) {
    return "slide-spray";
  }
  return "disinfectant";
}

export function resolveCleaningSupply(input: {
  categoryId: RentalCategoryId | string;
  cleaningSupply: string | null | undefined;
}): { cleaningSupply: CleaningSupply; explicit: boolean } {
  if (isCleaningSupply(input.cleaningSupply)) {
    return { cleaningSupply: input.cleaningSupply, explicit: true };
  }
  return {
    cleaningSupply: defaultCleaningSupply(input.categoryId),
    explicit: false,
  };
}

/**
 * Normalize blower rows: nonnegative whole quantities, combine duplicate HP.
 * Throws on invalid horsepower or negative/non-integer quantity.
 */
export function normalizeBlowerRequirements(
  value: unknown,
  options: { combineDuplicates?: boolean } = {},
): BlowerRequirement[] {
  const combineDuplicates = options.combineDuplicates !== false;
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new Error("Blower requirements must be an array.");
  }

  const totals = new Map<BlowerHorsepower, number>();
  const order: BlowerHorsepower[] = [];

  for (const raw of value) {
    if (!raw || typeof raw !== "object") {
      throw new Error("Each blower requirement must be an object.");
    }
    const record = raw as Record<string, unknown>;
    const horsepower = record.horsepower;
    if (!isBlowerHorsepower(horsepower)) {
      throw new Error('Blower horsepower must be "1", "1.5", "2", or "3".');
    }
    const quantity = Number(record.quantity);
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new Error("Blower quantity must be a nonnegative whole number.");
    }
    if (quantity === 0) continue;

    if (totals.has(horsepower)) {
      if (!combineDuplicates) {
        throw new Error("Duplicate blower horsepower rows are not allowed.");
      }
      totals.set(horsepower, (totals.get(horsepower) ?? 0) + quantity);
    } else {
      totals.set(horsepower, quantity);
      order.push(horsepower);
    }
  }

  return order.map((horsepower) => ({
    horsepower,
    quantity: totals.get(horsepower) ?? 0,
  }));
}

export function parseBlowerRequirementsLenient(value: unknown): BlowerRequirement[] {
  try {
    return normalizeBlowerRequirements(value, { combineDuplicates: true });
  } catch {
    return [];
  }
}

export function emptyInventoryDimensions(): InventoryDimensions {
  return {
    lengthFt: null,
    widthFt: null,
    heightFt: null,
    unit: "ft",
    sourceText: "",
    sourceUrl: "",
    manufacturer: "",
    confidence: null,
    researchNotes: "",
  };
}

export function parseInventoryDimensions(row: InventoryOpsRow): InventoryDimensions {
  return {
    lengthFt: parsePositiveDimension(row.length_ft),
    widthFt: parsePositiveDimension(row.width_ft),
    heightFt: parsePositiveDimension(row.height_ft),
    unit: isDimensionUnit(row.dimension_unit) ? row.dimension_unit : "ft",
    sourceText: cleanText(row.dimension_source_text),
    sourceUrl: cleanText(row.dimension_source_url),
    manufacturer: cleanText(row.dimension_manufacturer),
    confidence: isDimensionConfidence(row.dimension_confidence)
      ? row.dimension_confidence
      : null,
    researchNotes: cleanText(row.dimension_research_notes),
  };
}

export function parseInventoryOperationalFields(
  row: InventoryOpsRow,
): InventoryOperationalFields {
  const categoryId = cleanText(row.category_id) || "bounce-houses";
  const cleaning = resolveCleaningSupply({
    categoryId,
    cleaningSupply: row.cleaning_supply,
  });

  return {
    blowerRequirements: parseBlowerRequirementsLenient(row.blower_requirements),
    tarpRequirement: cleanText(row.tarp_requirement),
    cleaningSupply: cleaning.cleaningSupply,
    cleaningSupplyExplicit: cleaning.explicit,
    dimensions: parseInventoryDimensions(row),
  };
}

export function validateInventoryOperationalInput(input: {
  blowerRequirements: unknown;
  tarpRequirement: unknown;
  cleaningSupply: unknown;
  lengthFt: unknown;
  widthFt: unknown;
  heightFt: unknown;
  dimensionUnit: unknown;
  dimensionSourceText: unknown;
  dimensionSourceUrl: unknown;
  dimensionManufacturer: unknown;
  dimensionConfidence: unknown;
  dimensionResearchNotes: unknown;
}): InventoryOpsDbPayload {
  const blowerRequirements = normalizeBlowerRequirements(input.blowerRequirements, {
    combineDuplicates: true,
  });

  if (typeof input.tarpRequirement !== "string") {
    throw new Error("Tarp requirement must be text.");
  }
  const tarpRequirement = input.tarpRequirement.trim();

  if (!isCleaningSupply(input.cleaningSupply)) {
    throw new Error('Cleaning supply must be "slide-spray" or "disinfectant".');
  }

  const lengthFt = parsePositiveDimension(
    input.lengthFt as number | string | null | undefined,
  );
  const widthFt = parsePositiveDimension(
    input.widthFt as number | string | null | undefined,
  );
  const heightFt = parsePositiveDimension(
    input.heightFt as number | string | null | undefined,
  );

  const unit = isDimensionUnit(input.dimensionUnit) ? input.dimensionUnit : "ft";
  const confidence =
    input.dimensionConfidence === "" || input.dimensionConfidence == null
      ? null
      : isDimensionConfidence(input.dimensionConfidence)
        ? input.dimensionConfidence
        : (() => {
            throw new Error(
              'Dimension confidence must be "verified", "high", "medium", or "unresolved".',
            );
          })();

  return {
    blower_requirements: blowerRequirements,
    tarp_requirement: tarpRequirement,
    cleaning_supply: input.cleaningSupply,
    length_ft: lengthFt,
    width_ft: widthFt,
    height_ft: heightFt,
    dimension_unit: unit,
    dimension_source_text: cleanText(
      typeof input.dimensionSourceText === "string"
        ? input.dimensionSourceText
        : "",
    ),
    dimension_source_url: cleanText(
      typeof input.dimensionSourceUrl === "string" ? input.dimensionSourceUrl : "",
    ),
    dimension_manufacturer: cleanText(
      typeof input.dimensionManufacturer === "string"
        ? input.dimensionManufacturer
        : "",
    ),
    dimension_confidence: confidence,
    dimension_research_notes: cleanText(
      typeof input.dimensionResearchNotes === "string"
        ? input.dimensionResearchNotes
        : "",
    ),
  };
}

/** Catalog sync must never write these columns so owner edits persist. */
export const INVENTORY_OPS_SYNC_OMIT_COLUMNS = [
  "blower_requirements",
  "tarp_requirement",
  "cleaning_supply",
  "length_ft",
  "width_ft",
  "height_ft",
  "dimension_unit",
  "dimension_source_text",
  "dimension_source_url",
  "dimension_manufacturer",
  "dimension_confidence",
  "dimension_research_notes",
] as const;

export function catalogSyncOmitsOperationalFields(
  payload: Record<string, unknown>,
): boolean {
  return INVENTORY_OPS_SYNC_OMIT_COLUMNS.every((column) => !(column in payload));
}

export function totalBlowerCount(
  blowers: readonly BlowerRequirement[] | null | undefined,
): number {
  if (!blowers?.length) return 0;
  return blowers.reduce((sum, row) => sum + Math.max(0, row.quantity), 0);
}

export function blowerTotalsByHorsepower(
  blowers: readonly BlowerRequirement[] | null | undefined,
): Record<BlowerHorsepower, number> {
  const totals: Record<BlowerHorsepower, number> = {
    "1": 0,
    "1.5": 0,
    "2": 0,
    "3": 0,
  };
  for (const row of blowers ?? []) {
    if (!isBlowerHorsepower(row.horsepower)) continue;
    totals[row.horsepower] += Math.max(0, row.quantity);
  }
  return totals;
}

export function required100FootCordCount(
  blowers: readonly BlowerRequirement[] | null | undefined,
): number {
  return totalBlowerCount(blowers);
}

export function required50FootCordCount(
  blowers: readonly BlowerRequirement[] | null | undefined,
): number {
  return totalBlowerCount(blowers);
}

export function formatBlowerSummary(
  blowers: readonly BlowerRequirement[] | null | undefined,
): string {
  const rows = (blowers ?? []).filter((row) => row.quantity > 0);
  if (rows.length === 0) return "No blowers";
  return rows
    .map((row) => `${row.quantity} × ${row.horsepower} HP`)
    .join(", ");
}

export function formatDimensionsSummary(
  dimensions: InventoryDimensions | null | undefined,
): string {
  if (!dimensions) return "Dimensions unknown";
  const { lengthFt, widthFt, heightFt, unit } = dimensions;
  if (lengthFt == null && widthFt == null && heightFt == null) {
    return "Dimensions unknown";
  }
  const parts = [lengthFt, widthFt, heightFt]
    .map((value) => (value == null ? "?" : String(value)))
    .join(" × ");
  return `${parts} ${unit}`;
}

export function formatCleaningSupplyLabel(value: CleaningSupply): string {
  return CLEANING_LABELS[value];
}

export function formatCordSummary(
  blowers: readonly BlowerRequirement[] | null | undefined,
): string {
  const total = totalBlowerCount(blowers);
  return [
    `${total} total blower${total === 1 ? "" : "s"}`,
    `${required100FootCordCount(blowers)} × 100-foot cords`,
    `${required50FootCordCount(blowers)} × 50-foot cords`,
  ].join("\n");
}
