import {
  getRentalBySlug,
  isInflatableRental,
  isWaterslideRental,
} from "@/data/rentals";

export type RentalCartLineInput = {
  rental_item: string;
  rental_name?: string;
};

export type InflatableSetupKind = "standard" | "waterslide";

/** One inflatable currently in the cart that needs setup-distance answers. */
export type InflatableSetupCartLine = {
  rentalItemId: string;
  rentalName: string;
  kind: InflatableSetupKind;
};

export type InflatableSetupDistanceEntry = {
  rentalItemId: string;
  rentalName: string;
  powerDistanceFeet: number;
  waterDistanceFeet: number | null;
};

/** Raw (string) form field values, keyed by stable rental_item id. */
export type InflatableSetupDistanceDraft = {
  power: string;
  water: string;
};

export type InflatableSetupDistanceDrafts = Record<
  string,
  InflatableSetupDistanceDraft | undefined
>;

export type InflatableSetupFieldErrors = Record<
  string,
  { power?: string; water?: string }
>;

/**
 * Derives the inflatables that need setup-distance fields from the current
 * cart, using structured rental inventory data (categoryId) rather than
 * name matching. De-duplicates by rental_item and drops unknown/non-inflatable
 * rows.
 */
export function inflatableSetupCartLines(
  items: RentalCartLineInput[],
): InflatableSetupCartLine[] {
  const seen = new Set<string>();
  const lines: InflatableSetupCartLine[] = [];
  for (const item of items) {
    const rentalItemId = item.rental_item?.trim();
    if (!rentalItemId || seen.has(rentalItemId)) continue;
    const rental = getRentalBySlug(rentalItemId);
    if (!rental || !isInflatableRental(rental)) continue;
    seen.add(rentalItemId);
    lines.push({
      rentalItemId,
      rentalName: item.rental_name?.trim() || rental.title,
      kind: isWaterslideRental(rental) ? "waterslide" : "standard",
    });
  }
  return lines;
}

/** Same numeric convention as normalizeDistanceMiles: zero and decimals OK, negative/invalid rejected. */
export function normalizeSetupDistanceFeet(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function validateInflatableSetupDistances(
  lines: InflatableSetupCartLine[],
  drafts: InflatableSetupDistanceDrafts,
): InflatableSetupFieldErrors {
  const errors: InflatableSetupFieldErrors = {};
  for (const line of lines) {
    const draft = drafts[line.rentalItemId];
    const lineErrors: { power?: string; water?: string } = {};

    if (normalizeSetupDistanceFeet(draft?.power ?? "") === null) {
      lineErrors.power = draft?.power?.trim()
        ? "Enter a valid distance in feet (0 or more)."
        : "Distance from power outlet is required.";
    }

    if (line.kind === "waterslide") {
      if (normalizeSetupDistanceFeet(draft?.water ?? "") === null) {
        lineErrors.water = draft?.water?.trim()
          ? "Enter a valid distance in feet (0 or more)."
          : "Distance from water hookup is required.";
      }
    }

    if (lineErrors.power || lineErrors.water) {
      errors[line.rentalItemId] = lineErrors;
    }
  }
  return errors;
}

export function isInflatableSetupDistancesValid(
  lines: InflatableSetupCartLine[],
  drafts: InflatableSetupDistanceDrafts,
): boolean {
  return (
    Object.keys(validateInflatableSetupDistances(lines, drafts)).length === 0
  );
}

/**
 * Builds the structured submission payload for the current cart only —
 * removed/hidden items are never included because they are absent from
 * `lines`.
 */
export function buildInflatableSetupDistancePayload(
  lines: InflatableSetupCartLine[],
  drafts: InflatableSetupDistanceDrafts,
): InflatableSetupDistanceEntry[] {
  return lines.map((line) => {
    const draft = drafts[line.rentalItemId];
    const powerDistanceFeet = normalizeSetupDistanceFeet(draft?.power ?? "") ?? 0;
    const waterDistanceFeet =
      line.kind === "waterslide"
        ? normalizeSetupDistanceFeet(draft?.water ?? "")
        : null;
    return {
      rentalItemId: line.rentalItemId,
      rentalName: line.rentalName,
      powerDistanceFeet,
      waterDistanceFeet,
    };
  });
}

/**
 * Server-side parser for the untrusted request body. Re-derives
 * classification from inventory data rather than trusting the client, drops
 * duplicates/unknown items, and requires a water distance for waterslides.
 */
export function parseInflatableSetupDistancesFromRequest(
  value: unknown,
): InflatableSetupDistanceEntry[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const result: InflatableSetupDistanceEntry[] = [];

  for (const raw of value.slice(0, 40)) {
    if (!raw || typeof raw !== "object") continue;
    const rentalItemIdRaw = (raw as { rentalItemId?: unknown }).rentalItemId;
    const rentalItemId =
      typeof rentalItemIdRaw === "string" ? rentalItemIdRaw.trim() : "";
    if (!rentalItemId || seen.has(rentalItemId)) continue;

    const rental = getRentalBySlug(rentalItemId);
    if (!rental || !isInflatableRental(rental)) continue;

    const powerDistanceFeet = normalizeSetupDistanceFeet(
      (raw as { powerDistanceFeet?: unknown }).powerDistanceFeet,
    );
    if (powerDistanceFeet === null) continue;

    const isWaterslide = isWaterslideRental(rental);
    const waterDistanceFeet = isWaterslide
      ? normalizeSetupDistanceFeet(
          (raw as { waterDistanceFeet?: unknown }).waterDistanceFeet,
        )
      : null;
    if (isWaterslide && waterDistanceFeet === null) continue;

    const rentalNameRaw = (raw as { rentalName?: unknown }).rentalName;
    seen.add(rentalItemId);
    result.push({
      rentalItemId,
      rentalName:
        typeof rentalNameRaw === "string" && rentalNameRaw.trim()
          ? rentalNameRaw.trim()
          : rental.title,
      powerDistanceFeet,
      waterDistanceFeet,
    });
  }

  return result;
}

/** Confirms every inflatable currently in the cart has a parsed, valid entry. */
export function hasRequiredInflatableSetupDistances(
  requiredLines: InflatableSetupCartLine[],
  entries: InflatableSetupDistanceEntry[],
): boolean {
  const byId = new Map(entries.map((entry) => [entry.rentalItemId, entry]));
  return requiredLines.every((line) => {
    const entry = byId.get(line.rentalItemId);
    if (!entry) return false;
    if (line.kind === "waterslide" && entry.waterDistanceFeet === null) {
      return false;
    }
    return true;
  });
}

/** Human-readable lines for operational text (emails, notes). */
export function formatInflatableSetupDistanceLines(
  entries: InflatableSetupDistanceEntry[],
): string[] {
  return entries.flatMap((entry) => [
    `${entry.rentalName}:`,
    `  Power outlet: approximately ${entry.powerDistanceFeet} ft`,
    ...(entry.waterDistanceFeet != null
      ? [`  Water hookup: approximately ${entry.waterDistanceFeet} ft`]
      : []),
  ]);
}
