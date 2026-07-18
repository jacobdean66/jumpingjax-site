import type { RentalCategoryId } from "@/data/rentals";

export type InventoryRouteKind =
  | "standard"
  | "big-slide"
  | "accessory"
  | "foam"
  | "yard-game";

export type DimensionConfidence = "high" | "likely" | "unresolved";
export type DimensionUnits = "ft" | "in" | "m";

export type InventoryEquipmentEntry = {
  quantity: number;
  description: string;
};

export type InventoryDimensions = {
  length: number | null;
  width: number | null;
  height: number | null;
  units: DimensionUnits;
  notes: string;
  source: string;
  confidence: DimensionConfidence | null;
};

export type InventoryOperationalFields = {
  dimensions: InventoryDimensions;
  blowers: InventoryEquipmentEntry[];
  tarps: InventoryEquipmentEntry[];
  requiresSlideSpray: boolean;
  requiresDisinfectant: boolean;
  slideSprayOverridden: boolean;
  disinfectantOverridden: boolean;
};

export type InventoryOpsRow = {
  category_id?: string | null;
  route_kind?: string | null;
  length_ft?: number | string | null;
  width_ft?: number | string | null;
  height_ft?: number | string | null;
  dimension_units?: string | null;
  dimension_notes?: string | null;
  dimension_source?: string | null;
  dimension_confidence?: string | null;
  blowers?: unknown;
  tarps?: unknown;
  requires_slide_spray?: boolean | null;
  requires_disinfectant?: boolean | null;
};

const SLIDE_SPRAY_CATEGORIES = new Set<RentalCategoryId>([
  "slides",
  "water-slides",
  "combos",
]);

const DISINFECTANT_CATEGORIES = new Set<RentalCategoryId>([
  "bounce-houses",
  "obstacle-courses",
  "inflatable-games",
]);

const INFLATABLE_ROUTE_KINDS = new Set<InventoryRouteKind>([
  "standard",
  "big-slide",
]);

export function isInflatableCategory(
  categoryId: RentalCategoryId,
  routeKind: InventoryRouteKind = "standard",
): boolean {
  if (categoryId === "accessories" || categoryId === "yard-games") return false;
  if (categoryId === "foam-parties" || routeKind === "foam") return false;
  if (routeKind === "accessory" || routeKind === "yard-game") return false;
  return (
    SLIDE_SPRAY_CATEGORIES.has(categoryId) ||
    DISINFECTANT_CATEGORIES.has(categoryId) ||
    INFLATABLE_ROUTE_KINDS.has(routeKind)
  );
}

export function defaultRequiresSlideSpray(categoryId: RentalCategoryId): boolean {
  return SLIDE_SPRAY_CATEGORIES.has(categoryId);
}

export function defaultRequiresDisinfectant(categoryId: RentalCategoryId): boolean {
  return DISINFECTANT_CATEGORIES.has(categoryId);
}

export function resolveSupplyRequirements(input: {
  categoryId: RentalCategoryId;
  requiresSlideSpray: boolean | null | undefined;
  requiresDisinfectant: boolean | null | undefined;
}): {
  requiresSlideSpray: boolean;
  requiresDisinfectant: boolean;
  slideSprayOverridden: boolean;
  disinfectantOverridden: boolean;
} {
  const slideSprayOverridden = typeof input.requiresSlideSpray === "boolean";
  const disinfectantOverridden = typeof input.requiresDisinfectant === "boolean";
  return {
    requiresSlideSpray: slideSprayOverridden
      ? input.requiresSlideSpray === true
      : defaultRequiresSlideSpray(input.categoryId),
    requiresDisinfectant: disinfectantOverridden
      ? input.requiresDisinfectant === true
      : defaultRequiresDisinfectant(input.categoryId),
    slideSprayOverridden,
    disinfectantOverridden,
  };
}

function numberOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function cleanText(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function isDimensionUnits(value: string | null | undefined): value is DimensionUnits {
  return value === "ft" || value === "in" || value === "m";
}

function isDimensionConfidence(
  value: string | null | undefined,
): value is DimensionConfidence {
  return value === "high" || value === "likely" || value === "unresolved";
}

export function parseEquipmentEntries(value: unknown): InventoryEquipmentEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: InventoryEquipmentEntry[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    const quantity = Number(record.quantity);
    const description = cleanText(
      typeof record.description === "string"
        ? record.description
        : typeof record.type === "string"
          ? record.type
          : typeof record.size === "string"
            ? record.size
            : "",
    );
    if (!Number.isFinite(quantity) || quantity <= 0 || !description) continue;
    entries.push({
      quantity: Math.min(99, Math.floor(quantity)),
      description,
    });
  }
  return entries;
}

export function parseEquipmentEntriesFromForm(
  quantities: Array<string | null | undefined>,
  descriptions: Array<string | null | undefined>,
): InventoryEquipmentEntry[] {
  const max = Math.max(quantities.length, descriptions.length);
  const entries: InventoryEquipmentEntry[] = [];
  for (let index = 0; index < max; index += 1) {
    const quantity = Number(quantities[index] ?? "");
    const description = cleanText(descriptions[index] ?? "");
    if (!description) continue;
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Enter a valid quantity for "${description}".`);
    }
    entries.push({
      quantity: Math.min(99, Math.floor(quantity)),
      description,
    });
  }
  return entries;
}

export function totalEquipmentQuantity(entries: readonly InventoryEquipmentEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.quantity, 0);
}

/** Every blower requires one 100-ft and one 50-ft extension cord. */
export function extensionCordsFromBlowers(
  blowers: readonly InventoryEquipmentEntry[],
): { cords100ft: number; cords50ft: number } {
  const blowerCount = totalEquipmentQuantity(blowers);
  return { cords100ft: blowerCount, cords50ft: blowerCount };
}

export function formatEquipmentEntries(
  entries: readonly InventoryEquipmentEntry[],
): string {
  if (entries.length === 0) return "None listed";
  return entries
    .map((entry) => `${entry.quantity} × ${entry.description}`)
    .join("; ");
}

export function formatDimensions(dimensions: InventoryDimensions): string {
  const { length, width, height, units } = dimensions;
  if (length == null && width == null && height == null) return "Not listed";
  const parts = [
    length != null ? `${length}` : "?",
    width != null ? `${width}` : "?",
    height != null ? `${height}` : "?",
  ];
  return `${parts.join(" × ")} ${units}`;
}

export function emptyInventoryOperationalFields(
  categoryId: RentalCategoryId = "bounce-houses",
): InventoryOperationalFields {
  const supplies = resolveSupplyRequirements({
    categoryId,
    requiresSlideSpray: null,
    requiresDisinfectant: null,
  });
  return {
    dimensions: {
      length: null,
      width: null,
      height: null,
      units: "ft",
      notes: "",
      source: "",
      confidence: null,
    },
    blowers: [],
    tarps: [],
    ...supplies,
  };
}

export function operationalFieldsFromRow(
  row: InventoryOpsRow,
  categoryId: RentalCategoryId,
): InventoryOperationalFields {
  const supplies = resolveSupplyRequirements({
    categoryId,
    requiresSlideSpray: row.requires_slide_spray,
    requiresDisinfectant: row.requires_disinfectant,
  });
  return {
    dimensions: {
      length: numberOrNull(row.length_ft),
      width: numberOrNull(row.width_ft),
      height: numberOrNull(row.height_ft),
      units: isDimensionUnits(row.dimension_units) ? row.dimension_units : "ft",
      notes: cleanText(row.dimension_notes),
      source: cleanText(row.dimension_source),
      confidence: isDimensionConfidence(row.dimension_confidence)
        ? row.dimension_confidence
        : null,
    },
    blowers: parseEquipmentEntries(row.blowers),
    tarps: parseEquipmentEntries(row.tarps),
    ...supplies,
  };
}

export function operationalFieldsToRow(fields: InventoryOperationalFields): {
  length_ft: number | null;
  width_ft: number | null;
  height_ft: number | null;
  dimension_units: DimensionUnits;
  dimension_notes: string;
  dimension_source: string;
  dimension_confidence: DimensionConfidence | null;
  blowers: InventoryEquipmentEntry[];
  tarps: InventoryEquipmentEntry[];
  requires_slide_spray: boolean | null;
  requires_disinfectant: boolean | null;
} {
  return {
    length_ft: fields.dimensions.length,
    width_ft: fields.dimensions.width,
    height_ft: fields.dimensions.height,
    dimension_units: fields.dimensions.units,
    dimension_notes: fields.dimensions.notes,
    dimension_source: fields.dimensions.source,
    dimension_confidence: fields.dimensions.confidence,
    blowers: fields.blowers,
    tarps: fields.tarps,
    requires_slide_spray: fields.slideSprayOverridden
      ? fields.requiresSlideSpray
      : null,
    requires_disinfectant: fields.disinfectantOverridden
      ? fields.requiresDisinfectant
      : null,
  };
}

export function groupEquipmentByDescription(
  entries: readonly InventoryEquipmentEntry[],
): InventoryEquipmentEntry[] {
  const byDescription = new Map<string, number>();
  for (const entry of entries) {
    const key = entry.description.trim();
    if (!key) continue;
    byDescription.set(key, (byDescription.get(key) ?? 0) + entry.quantity);
  }
  return [...byDescription.entries()]
    .map(([description, quantity]) => ({ description, quantity }))
    .sort((a, b) => a.description.localeCompare(b.description));
}
