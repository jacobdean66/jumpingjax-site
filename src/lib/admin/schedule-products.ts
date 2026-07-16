import { isFoamPartyRentalItem } from "@/lib/rentals/rental-pricing-text";

export type ScheduleProduct = {
  rentalItem: string;
  name: string;
  quantity: number;
  isFoam: boolean;
  isAccessory: boolean;
};

export type ScheduleProductInput = {
  rental_item: string | null | undefined;
  rental_name: string | null | undefined;
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Aggregate booking line items into display products.
 * Quantity is the number of matching line rows for the same rental_item
 * (bookings store one row per distinct item today; qty > 1 is supported if
 * duplicate rows ever exist). Accessories follow catalog slug heuristics used
 * elsewhere: items containing "accessory" in slug/name, or known accessory patterns.
 */
export function aggregateScheduleProducts(
  items: readonly ScheduleProductInput[],
): ScheduleProduct[] {
  const byItem = new Map<string, ScheduleProduct>();

  for (const item of items) {
    const rentalItem = clean(item.rental_item) ?? "rental";
    const name = clean(item.rental_name) ?? rentalItem;
    const existing = byItem.get(rentalItem);
    if (existing) {
      existing.quantity += 1;
      continue;
    }
    byItem.set(rentalItem, {
      rentalItem,
      name,
      quantity: 1,
      isFoam: isFoamPartyRentalItem(rentalItem),
      isAccessory: isAccessoryProduct(rentalItem, name),
    });
  }

  return [...byItem.values()];
}

export function isAccessoryProduct(rentalItem: string, name: string): boolean {
  const slug = rentalItem.toLowerCase();
  const label = name.toLowerCase();
  return (
    slug.includes("accessor") ||
    label.includes("accessor") ||
    slug.startsWith("blower") ||
    slug.includes("extension-cord") ||
    slug.includes("stake")
  );
}

export function formatProductLabel(product: ScheduleProduct): string {
  return product.quantity > 1
    ? `${product.name} ×${product.quantity}`
    : product.name;
}

export function bookingContainsFoam(
  products: readonly ScheduleProduct[],
): boolean {
  return products.some((product) => product.isFoam);
}

/**
 * Foam filter policy for mixed carts:
 * A booking that contains any foam-party line item is classified as a foam-party
 * schedule event (type "foam-party"). Non-foam products on that booking still
 * appear in the product list. Pure rental bookings without foam stay "rental".
 */
export function classifyRentalScheduleType(
  products: readonly ScheduleProduct[],
): "rental" | "foam-party" {
  return bookingContainsFoam(products) ? "foam-party" : "rental";
}
