import type { WorkType } from "./delivery-planner-dates";

export type PrintTruckId = "truck-1" | "truck-2";

export type PrintFilterTruck = "all" | PrintTruckId;
export type PrintFilterWorkType = "all" | WorkType;

export type PrintPlanItem = {
  id: string;
  workType: WorkType;
  deliveryDate: string | null;
  deliveryTruck: PrintTruckId | null;
  trailerLoad: number | null;
  deliverySequence: number | null;
  rentalName: string;
};

export type PrintSheetGroup = {
  date: string;
  workType: WorkType;
  truck: PrintTruckId;
  workTypeLabel: string;
  items: PrintPlanItem[];
};

export type PrintDayGroup = {
  date: string;
  sheets: PrintSheetGroup[];
};

const PRINT_SHEET_ORDER: Array<{
  workType: WorkType;
  truck: PrintTruckId;
  workTypeLabel: string;
}> = [
  { workType: "delivery", truck: "truck-1", workTypeLabel: "Deliveries / Setups" },
  { workType: "delivery", truck: "truck-2", workTypeLabel: "Deliveries / Setups" },
  { workType: "pickup", truck: "truck-1", workTypeLabel: "Pickups" },
  { workType: "pickup", truck: "truck-2", workTypeLabel: "Pickups" },
];

/** Operational label under the printed item name, from stop work type only. */
export function printStopWorkLabel(workType: WorkType): "Drop-off" | "Pickup" {
  return workType === "pickup" ? "Pickup" : "Drop-off";
}

function itemMatchesPrintFilters(
  item: PrintPlanItem,
  printTruck: PrintFilterTruck,
  printWorkType: PrintFilterWorkType,
): boolean {
  if (printTruck !== "all" && item.deliveryTruck !== printTruck) return false;
  if (printWorkType !== "all" && item.workType !== printWorkType) return false;
  return true;
}

/**
 * Build print day/sheet groups. Omits any date, work-type, truck, or load
 * section that has zero actual stops. Preserves date → work type → truck order.
 */
export function buildPrintDayGroups<T extends PrintPlanItem>(options: {
  dates: string[];
  items: T[];
  printTruck?: PrintFilterTruck;
  printWorkType?: PrintFilterWorkType;
}): Array<{ date: string; sheets: Array<Omit<PrintSheetGroup, "items"> & { items: T[] }> }> {
  const printTruck = options.printTruck ?? "all";
  const printWorkType = options.printWorkType ?? "all";
  const filteredItems = options.items.filter((item) =>
    itemMatchesPrintFilters(item, printTruck, printWorkType),
  );

  const days: Array<{
    date: string;
    sheets: Array<Omit<PrintSheetGroup, "items"> & { items: T[] }>;
  }> = [];

  for (const date of options.dates) {
    const dayItems = filteredItems.filter((item) => item.deliveryDate === date);
    const sheets: Array<Omit<PrintSheetGroup, "items"> & { items: T[] }> = [];

    for (const slot of PRINT_SHEET_ORDER) {
      if (printWorkType !== "all" && printWorkType !== slot.workType) continue;
      if (printTruck !== "all" && printTruck !== slot.truck) continue;

      const items = dayItems.filter(
        (item) =>
          item.workType === slot.workType && item.deliveryTruck === slot.truck,
      );
      if (items.length === 0) continue;

      sheets.push({
        date,
        workType: slot.workType,
        truck: slot.truck,
        workTypeLabel: slot.workTypeLabel,
        items,
      });
    }

    if (sheets.length === 0) continue;
    days.push({ date, sheets });
  }

  return days;
}

/**
 * Drop empty load buckets so print never emits a zero-stop load section.
 * Preserves load order from the input.
 */
export function filterNonEmptyPrintLoads<T>(loads: T[][]): T[][] {
  return loads.filter((load) => load.length > 0);
}
