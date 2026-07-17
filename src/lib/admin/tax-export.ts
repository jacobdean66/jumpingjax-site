export type TaxExportDateBasis = "event" | "created" | "payment";

export type TaxExportLine = {
  bookingNumber: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  customerEmail: string;
  createdAt: string;
  eventDate: string;
  deliveryDate: string;
  pickupDate: string;
  products: string;
  quantities: string;
  amountCharged: number | null;
  amountPaid: number | null;
  remainingBalance: number | null;
  discounts: number | null;
  deliveryFees: number | null;
  taxesCollected: number | null;
  otherFees: number | null;
  refunds: number | null;
  paymentStatus: string;
  paymentMethod: string;
  bookingStatus: string;
  includeInRevenueTotals: boolean;
};

export type TaxExportTotals = {
  amountCharged: number;
  amountPaid: number;
  taxes: number;
  fees: number;
  refunds: number;
  outstandingBalance: number;
};

export type TaxExportSourceBooking = {
  id: string;
  createdAt: string | null;
  status: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  eventAddress: string | null;
  eventDate: string;
  deliveryDate: string | null;
  pickupDate: string | null;
  paymentMethod: string | null;
  paymentConfirmedAt: string | null;
  subtotal: number | null;
  deliveryFee: number | null;
  mileageFee: number | null;
  total: number | null;
  tax: number | null;
  discount: number | null;
  refundAmount: number | null;
  amountPaid: number | null;
  items: { rental_item: string; rental_name: string; quantity?: number }[];
};

const CANCELED_STATUSES = new Set(["cancelled", "canceled", "rejected"]);

function moneyOrNull(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number.isFinite(value) ? value : null;
}

function csvEscape(value: string): string {
  // Neutralize spreadsheet formula injection before CSV quoting.
  const safe =
    /^[=+\-@\t\r]/.test(value) || value.includes("\t")
      ? `'${value}`
      : value;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function formatMoneyCell(value: number | null): string {
  if (value === null) return "";
  return value.toFixed(2);
}

export function shouldIncludeInRevenueTotals(input: {
  status: string;
  amountPaid: number | null;
  refundAmount: number | null;
}): boolean {
  const canceled = CANCELED_STATUSES.has(input.status.trim().toLowerCase());
  if (!canceled) return true;
  const paid = input.amountPaid ?? 0;
  const refunded = input.refundAmount ?? 0;
  return paid - refunded > 0;
}

export function deriveAmountPaid(input: {
  total: number | null;
  paymentConfirmedAt: string | null;
  amountPaid: number | null;
}): number | null {
  if (input.amountPaid !== null && input.amountPaid !== undefined) {
    return moneyOrNull(input.amountPaid);
  }
  if (input.paymentConfirmedAt && input.total !== null) {
    return moneyOrNull(input.total);
  }
  return null;
}

export function deriveRemainingBalance(input: {
  total: number | null;
  amountPaid: number | null;
  refunds: number | null;
}): number | null {
  if (input.total === null) return null;
  const paid = input.amountPaid ?? 0;
  const refunds = input.refunds ?? 0;
  return Math.max(0, input.total - paid + refunds);
}

export function toTaxExportLine(booking: TaxExportSourceBooking): TaxExportLine {
  const amountPaid = deriveAmountPaid({
    total: booking.total,
    paymentConfirmedAt: booking.paymentConfirmedAt,
    amountPaid: booking.amountPaid,
  });
  const refunds = moneyOrNull(booking.refundAmount);
  // Keep delivery and mileage in separate CSV columns so totals do not
  // double-count mileage as both "delivery fees" and "other fees".
  const deliveryFees = moneyOrNull(booking.deliveryFee);
  const otherFees = moneyOrNull(booking.mileageFee);
  const remainingBalance = deriveRemainingBalance({
    total: booking.total,
    amountPaid,
    refunds,
  });
  const includeInRevenueTotals = shouldIncludeInRevenueTotals({
    status: booking.status,
    amountPaid,
    refundAmount: refunds,
  });

  const quantities = booking.items.map((item) => String(item.quantity ?? 1));
  const products = booking.items.map((item) => item.rental_name || item.rental_item);

  let paymentStatus = "unpaid";
  if (amountPaid !== null && booking.total !== null) {
    if (amountPaid <= 0) paymentStatus = "unpaid";
    else if (remainingBalance !== null && remainingBalance > 0) {
      paymentStatus = "partial";
    } else paymentStatus = "paid";
  } else if (booking.paymentConfirmedAt) {
    paymentStatus = "paid";
  }

  return {
    bookingNumber: booking.id,
    customerName: booking.customerName,
    customerAddress: booking.eventAddress ?? "",
    customerPhone: booking.customerPhone ?? "",
    customerEmail: booking.customerEmail ?? "",
    createdAt: booking.createdAt ?? "",
    eventDate: booking.eventDate,
    deliveryDate: booking.deliveryDate ?? booking.eventDate,
    pickupDate: booking.pickupDate ?? "",
    products: products.join("; "),
    quantities: quantities.join("; "),
    amountCharged: moneyOrNull(booking.total),
    amountPaid,
    remainingBalance,
    discounts: moneyOrNull(booking.discount),
    deliveryFees,
    taxesCollected: moneyOrNull(booking.tax),
    otherFees,
    refunds,
    paymentStatus,
    paymentMethod: booking.paymentMethod ?? "",
    bookingStatus: booking.status,
    includeInRevenueTotals,
  };
}

export function computeTaxExportTotals(
  lines: readonly TaxExportLine[],
): TaxExportTotals {
  return lines.reduce<TaxExportTotals>(
    (totals, line) => {
      if (!line.includeInRevenueTotals) return totals;
      totals.amountCharged += line.amountCharged ?? 0;
      totals.amountPaid += line.amountPaid ?? 0;
      totals.taxes += line.taxesCollected ?? 0;
      totals.fees +=
        (line.deliveryFees ?? 0) + (line.otherFees ?? 0);
      totals.refunds += line.refunds ?? 0;
      totals.outstandingBalance += line.remainingBalance ?? 0;
      return totals;
    },
    {
      amountCharged: 0,
      amountPaid: 0,
      taxes: 0,
      fees: 0,
      refunds: 0,
      outstandingBalance: 0,
    },
  );
}

export function taxExportToCsv(
  lines: readonly TaxExportLine[],
  totals: TaxExportTotals,
  meta: { dateBasis: TaxExportDateBasis; from: string; to: string },
): string {
  const headers = [
    "Booking number",
    "Customer name",
    "Customer address",
    "Customer phone",
    "Customer email",
    "Booking creation date",
    "Event / rental date",
    "Delivery date",
    "Pickup date",
    "Products rented",
    "Product quantities",
    "Amount charged",
    "Amount paid",
    "Remaining balance",
    "Discounts",
    "Delivery fees",
    "Taxes collected",
    "Other fees",
    "Refunds",
    "Payment status",
    "Payment method",
    "Booking status",
  ];

  const rows = lines.map((line) =>
    [
      line.bookingNumber,
      line.customerName,
      line.customerAddress,
      line.customerPhone,
      line.customerEmail,
      line.createdAt,
      line.eventDate,
      line.deliveryDate,
      line.pickupDate,
      line.products,
      line.quantities,
      formatMoneyCell(line.amountCharged),
      formatMoneyCell(line.amountPaid),
      formatMoneyCell(line.remainingBalance),
      formatMoneyCell(line.discounts),
      formatMoneyCell(line.deliveryFees),
      formatMoneyCell(line.taxesCollected),
      formatMoneyCell(line.otherFees),
      formatMoneyCell(line.refunds),
      line.paymentStatus,
      line.paymentMethod,
      line.bookingStatus,
    ]
      .map((cell) => csvEscape(String(cell)))
      .join(","),
  );

  const blank = headers.map(() => "").join(",");
  const totalsRow = [
    "TOTALS",
    `Date basis: ${meta.dateBasis}`,
    `From: ${meta.from}`,
    `To: ${meta.to}`,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    formatMoneyCell(totals.amountCharged),
    formatMoneyCell(totals.amountPaid),
    formatMoneyCell(totals.outstandingBalance),
    "",
    "",
    formatMoneyCell(totals.taxes),
    formatMoneyCell(totals.fees),
    formatMoneyCell(totals.refunds),
    "",
    "",
    "",
  ]
    .map((cell) => csvEscape(String(cell)))
    .join(",");

  return [headers.join(","), ...rows, blank, totalsRow].join("\r\n");
}

export function dateBasisLabel(basis: TaxExportDateBasis): string {
  if (basis === "created") return "booking creation date";
  if (basis === "payment") return "payment confirmation date";
  return "event / rental date";
}
