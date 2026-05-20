export type CottonCandyPackage = "none" | "10_kids" | "20_kids";

export type FacilityAddonSelectionsInput = {
  customBirthdayBalloons?: boolean;
  goodieBagsQuantity?: number;
  cottonCandyPackage?: CottonCandyPackage | string;
};

export type StoredFacilityAddonSelections = {
  customBirthdayBalloons: boolean;
  goodieBagsQuantity: number;
  cottonCandyPackage: CottonCandyPackage;
};

export type ResolvedFacilityAddonLine = {
  key: string;
  label: string;
  detail: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type ResolvedFacilityAddons = {
  selections: StoredFacilityAddonSelections;
  lines: ResolvedFacilityAddonLine[];
  subtotal: number;
};

const BALLOONS_PRICE = 10;
const GOODIE_BAG_EACH = 3.5;
const COTTON_CANDY_10 = 15;
const COTTON_CANDY_20 = 20;
const MAX_GOODIE_BAGS = 100;

function isCottonCandyPackage(value: unknown): value is CottonCandyPackage {
  return value === "none" || value === "10_kids" || value === "20_kids";
}

function normalizeGoodieBagsQuantity(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  const qty = Math.floor(value);
  if (qty < 1) return 0;
  return Math.min(qty, MAX_GOODIE_BAGS);
}

export function resolveFacilityAddons(
  input: FacilityAddonSelectionsInput | null | undefined,
): ResolvedFacilityAddons {
  const selections: StoredFacilityAddonSelections = {
    customBirthdayBalloons: input?.customBirthdayBalloons === true,
    goodieBagsQuantity: normalizeGoodieBagsQuantity(input?.goodieBagsQuantity),
    cottonCandyPackage: isCottonCandyPackage(input?.cottonCandyPackage)
      ? input.cottonCandyPackage
      : "none",
  };

  const lines: ResolvedFacilityAddonLine[] = [];

  if (selections.customBirthdayBalloons) {
    lines.push({
      key: "customBirthdayBalloons",
      label: "Custom Birthday Balloons",
      detail: null,
      unitPrice: BALLOONS_PRICE,
      quantity: 1,
      lineTotal: BALLOONS_PRICE,
    });
  }

  if (selections.goodieBagsQuantity > 0) {
    lines.push({
      key: "goodieBags",
      label: "Goodie Bags",
      detail: `${selections.goodieBagsQuantity} @ $${GOODIE_BAG_EACH.toFixed(2)} each`,
      unitPrice: GOODIE_BAG_EACH,
      quantity: selections.goodieBagsQuantity,
      lineTotal: selections.goodieBagsQuantity * GOODIE_BAG_EACH,
    });
  }

  if (selections.cottonCandyPackage === "10_kids") {
    lines.push({
      key: "cottonCandy10",
      label: "Cotton Candy Package",
      detail: "10 kids",
      unitPrice: COTTON_CANDY_10,
      quantity: 1,
      lineTotal: COTTON_CANDY_10,
    });
  } else if (selections.cottonCandyPackage === "20_kids") {
    lines.push({
      key: "cottonCandy20",
      label: "Cotton Candy Package",
      detail: "20 kids",
      unitPrice: COTTON_CANDY_20,
      quantity: 1,
      lineTotal: COTTON_CANDY_20,
    });
  }

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);

  return { selections, lines, subtotal };
}

export function previewAddonSubtotal(
  input: FacilityAddonSelectionsInput,
): number {
  return resolveFacilityAddons(input).subtotal;
}

export function formatFacilityAddonsForEmail(
  addons: ResolvedFacilityAddons | null,
): string {
  if (!addons || addons.lines.length === 0) {
    return "Add-ons: None selected";
  }

  const lineText = addons.lines.map((line) => {
    const price = `$${line.lineTotal.toFixed(2)}`;
    return line.detail
      ? `- ${line.label} (${line.detail}) — ${price}`
      : `- ${line.label} — ${price}`;
  });

  return ["Add-ons:", ...lineText, `Add-ons subtotal: $${addons.subtotal.toFixed(2)}`].join(
    "\n",
  );
}

export function facilityAddonsForStorage(
  addons: ResolvedFacilityAddons,
): Record<string, unknown> {
  return {
    selections: addons.selections,
    lines: addons.lines,
    subtotal: addons.subtotal,
  };
}

export function formatStoredFacilityAddons(stored: unknown): string {
  if (!stored || typeof stored !== "object") {
    return "Add-ons: None selected";
  }

  const record = stored as {
    lines?: ResolvedFacilityAddonLine[];
    subtotal?: number;
    selections?: StoredFacilityAddonSelections;
  };

  if (Array.isArray(record.lines) && record.lines.length > 0) {
    const subtotal =
      typeof record.subtotal === "number"
        ? record.subtotal
        : record.lines.reduce((sum, line) => sum + line.lineTotal, 0);
    return formatFacilityAddonsForEmail({
      selections: record.selections ?? {
        customBirthdayBalloons: false,
        goodieBagsQuantity: 0,
        cottonCandyPackage: "none",
      },
      lines: record.lines,
      subtotal,
    });
  }

  if (record.selections) {
    return formatFacilityAddonsForEmail(resolveFacilityAddons(record.selections));
  }

  return "Add-ons: None selected";
}
