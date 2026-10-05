import { money, type InvoiceLineItem } from "./shared";

/** Keep the agreed subtotal even when today's catalog exceeds that price. */
export function reconcileRentalLines(lines: InvoiceLineItem[], subtotal: number) {
  let difference = Math.round((money(subtotal) - money(lines.reduce((sum, line) => sum + line.unitPrice, 0))) * 100);
  for (let index = lines.length - 1; index >= 0 && difference !== 0; index--) {
    const line = lines[index]!;
    const cents = Math.round(line.unitPrice * 100);
    const adjustment = difference > 0 ? difference : Math.max(difference, -cents);
    line.unitPrice = (cents + adjustment) / 100;
    difference -= adjustment;
  }
  return lines;
}
