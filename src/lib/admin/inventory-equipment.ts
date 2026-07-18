import {
  extensionCordsFromBlowers,
  groupEquipmentByDescription,
  totalEquipmentQuantity,
  type InventoryEquipmentEntry,
  type InventoryOperationalFields,
} from "./inventory-ops";

export type LoadEquipmentItem = {
  taskId: string;
  rentalItem: string;
  rentalName: string;
  isInflatable: boolean;
  ops: InventoryOperationalFields;
  cords100ft: number;
  cords50ft: number;
};

export type LoadEquipmentTotals = {
  inflatableCount: number;
  blowers: InventoryEquipmentEntry[];
  blowerCount: number;
  cords100ft: number;
  cords50ft: number;
  tarps: InventoryEquipmentEntry[];
  slideSprayCount: number;
  disinfectantCount: number;
};

export function equipmentForItem(input: {
  taskId: string;
  rentalItem: string;
  rentalName: string;
  isInflatable: boolean;
  ops: InventoryOperationalFields;
}): LoadEquipmentItem {
  const cords = extensionCordsFromBlowers(input.ops.blowers);
  return {
    taskId: input.taskId,
    rentalItem: input.rentalItem,
    rentalName: input.rentalName,
    isInflatable: input.isInflatable,
    ops: input.ops,
    cords100ft: cords.cords100ft,
    cords50ft: cords.cords50ft,
  };
}

/**
 * Consolidate equipment for a trailer/load. Dedupes by taskId so the same
 * booking line is never counted twice when present in multiple structures.
 */
export function consolidateLoadEquipment(
  items: readonly LoadEquipmentItem[],
): LoadEquipmentTotals {
  const seen = new Set<string>();
  const unique: LoadEquipmentItem[] = [];
  for (const item of items) {
    const key = item.taskId || `${item.rentalItem}:${item.rentalName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  const blowers: InventoryEquipmentEntry[] = [];
  const tarps: InventoryEquipmentEntry[] = [];
  let cords100ft = 0;
  let cords50ft = 0;
  let slideSprayCount = 0;
  let disinfectantCount = 0;
  let inflatableCount = 0;

  for (const item of unique) {
    if (item.isInflatable) inflatableCount += 1;
    blowers.push(...item.ops.blowers);
    tarps.push(...item.ops.tarps);
    cords100ft += item.cords100ft;
    cords50ft += item.cords50ft;
    if (item.ops.requiresSlideSpray) slideSprayCount += 1;
    if (item.ops.requiresDisinfectant) disinfectantCount += 1;
  }

  const groupedBlowers = groupEquipmentByDescription(blowers);
  return {
    inflatableCount,
    blowers: groupedBlowers,
    blowerCount: totalEquipmentQuantity(groupedBlowers),
    cords100ft,
    cords50ft,
    tarps: groupEquipmentByDescription(tarps),
    slideSprayCount,
    disinfectantCount,
  };
}

export function formatLoadEquipmentTotals(totals: LoadEquipmentTotals): string[] {
  const lines = [
    `Inflatables: ${totals.inflatableCount}`,
    `Blowers: ${totals.blowerCount}${
      totals.blowers.length
        ? ` (${totals.blowers.map((b) => `${b.quantity}× ${b.description}`).join(", ")})`
        : ""
    }`,
    `100-ft cords: ${totals.cords100ft}`,
    `50-ft cords: ${totals.cords50ft}`,
    `Tarps: ${
      totals.tarps.length
        ? totals.tarps.map((t) => `${t.quantity}× ${t.description}`).join(", ")
        : "0"
    }`,
    `Slide spray: ${totals.slideSprayCount}`,
    `Disinfectant: ${totals.disinfectantCount}`,
  ];
  return lines;
}
