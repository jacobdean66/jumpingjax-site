export type InvoiceKind = "rental" | "facility" | "standalone";

export type InvoiceLineItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type BookingInvoice = {
  kind: InvoiceKind;
  bookingId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  billingAddress: string;
  eventDate: string;
  eventAddress: string;
  eventDetails: string;
  lineItems: InvoiceLineItem[];
  deliveryFee: number;
  discount: number;
  tax: number;
  paymentsReceived: number;
  notes: string;
};

export type InvoiceTotals = {
  subtotal: number;
  total: number;
  balanceDue: number;
};

function todayYmd(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function createBlankStandaloneInvoice(bookingId: string): BookingInvoice {
  const today = todayYmd();
  return {
    kind: "standalone",
    bookingId,
    invoiceNumber: `JJ-${today.replaceAll("-", "")}-${bookingId.slice(0, 6).toUpperCase()}`,
    invoiceDate: today,
    dueDate: today,
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    billingAddress: "",
    eventDate: "",
    eventAddress: "",
    eventDetails: "",
    lineItems: [{ id: "line-1", description: "Rental or service", quantity: 1, unitPrice: 0 }],
    deliveryFee: 0,
    discount: 0,
    tax: 0,
    paymentsReceived: 0,
    notes: "",
  };
}

export function createTestInvoice(): BookingInvoice {
  return {
    ...createBlankStandaloneInvoice("test-preview"),
    invoiceNumber: "JJ-TEST-1001",
    invoiceDate: "2026-09-01",
    dueDate: "2026-09-12",
    customerName: "Taylor Williams",
    customerEmail: "taylor@example.com",
    customerPhone: "864-555-0142",
    billingAddress: "214 Magnolia Lane\nGreenwood, SC 29649",
    eventDate: "September 12, 2026 at 2:00 PM",
    eventAddress: "214 Magnolia Lane, Greenwood, SC 29649",
    eventDetails: "Backyard birthday party · Setup on grass",
    lineItems: [
      { id: "test-slide", description: "22' Hurricane Waterslide", quantity: 1, unitPrice: 400 },
      { id: "test-tables", description: "6-foot folding tables", quantity: 2, unitPrice: 12.5 },
    ],
    deliveryFee: 25,
    discount: 25,
    paymentsReceived: 100,
    notes: "Please have the setup area clear before delivery.",
  };
}

export function money(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

export function calculateInvoiceTotals(invoice: BookingInvoice): InvoiceTotals {
  const subtotal = money(
    invoice.lineItems.reduce(
      (sum, item) => sum + money(item.quantity) * money(item.unitPrice),
      0,
    ),
  );
  const total = money(
    subtotal + money(invoice.deliveryFee) + money(invoice.tax) - money(invoice.discount),
  );
  return {
    subtotal,
    total,
    balanceDue: Math.max(0, money(total - money(invoice.paymentsReceived))),
  };
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value.slice(0, 4000) : fallback;
}

export function normalizeInvoice(
  value: unknown,
  fallback: BookingInvoice,
): BookingInvoice {
  if (!value || typeof value !== "object") return fallback;
  const input = value as Record<string, unknown>;
  const rawLines = Array.isArray(input.lineItems) ? input.lineItems : fallback.lineItems;
  const lineItems = rawLines
    .slice(0, 40)
    .map((raw, index): InvoiceLineItem | null => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Record<string, unknown>;
      return {
        id: stringValue(row.id, `line-${index + 1}`).slice(0, 120),
        description: stringValue(row.description, "Rental or service").slice(0, 500),
        quantity: Math.max(0, Math.min(999, money(row.quantity))),
        unitPrice: Math.max(0, Math.min(1_000_000, money(row.unitPrice))),
      };
    })
    .filter((line): line is InvoiceLineItem => Boolean(line));

  return {
    ...fallback,
    invoiceNumber: stringValue(input.invoiceNumber, fallback.invoiceNumber).slice(0, 100),
    invoiceDate: stringValue(input.invoiceDate, fallback.invoiceDate).slice(0, 10),
    dueDate: stringValue(input.dueDate, fallback.dueDate).slice(0, 10),
    customerName: stringValue(input.customerName, fallback.customerName).slice(0, 300),
    customerEmail: stringValue(input.customerEmail, fallback.customerEmail).slice(0, 320),
    customerPhone: stringValue(input.customerPhone, fallback.customerPhone).slice(0, 100),
    billingAddress: stringValue(input.billingAddress, fallback.billingAddress),
    eventDate: stringValue(input.eventDate, fallback.eventDate).slice(0, 100),
    eventAddress: stringValue(input.eventAddress, fallback.eventAddress),
    eventDetails: stringValue(input.eventDetails, fallback.eventDetails),
    lineItems: lineItems.length > 0 ? lineItems : fallback.lineItems,
    deliveryFee: Math.max(0, money(input.deliveryFee ?? fallback.deliveryFee)),
    discount: Math.max(0, money(input.discount ?? fallback.discount)),
    tax: Math.max(0, money(input.tax ?? fallback.tax)),
    paymentsReceived: Math.max(
      0,
      money(input.paymentsReceived ?? fallback.paymentsReceived),
    ),
    notes: stringValue(input.notes, fallback.notes),
  };
}
