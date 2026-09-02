import "server-only";

import { estimateRentalLineSubtotal } from "@/lib/rentals/rental-pricing-text";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  calculateInvoiceTotals,
  money,
  normalizeInvoice,
  type BookingInvoice,
  type InvoiceKind,
  type InvoiceLineItem,
} from "./shared";

const BUSINESS_ADDRESS = "559 Beaudrot Road, Greenwood, SC";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function todayYmd(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function rentalLines(input: {
  items: { rental_item: string; rental_name: string | null }[];
  duration: string;
  foamDuration: string;
  spanDays: number;
  storedSubtotal: number;
}): InvoiceLineItem[] {
  if (input.items.length === 1 && input.storedSubtotal > 0) {
    const item = input.items[0]!;
    return [{
      id: `rental-${item.rental_item}`,
      description: clean(item.rental_name) || item.rental_item,
      quantity: 1,
      unitPrice: input.storedSubtotal,
    }];
  }

  const lines = input.items.map((item, index) => ({
    id: `rental-${index + 1}-${item.rental_item}`,
    description: clean(item.rental_name) || item.rental_item,
    quantity: 1,
    unitPrice:
      estimateRentalLineSubtotal(
        {
          rental_item: item.rental_item,
          rental_name: item.rental_name ?? undefined,
        },
        input.duration,
        input.spanDays,
        input.foamDuration,
      ) ?? 0,
  }));

  // Historical bookings keep the charged rental subtotal as the source of
  // truth. Catalog prices can change, so absorb any difference into the final
  // booking line while preserving an editable price for every item.
  if (input.storedSubtotal > 0 && lines.length > 0) {
    const estimatedSubtotal = money(
      lines.reduce((sum, line) => sum + line.unitPrice, 0),
    );
    const finalLine = lines[lines.length - 1]!;
    finalLine.unitPrice = Math.max(
      0,
      money(finalLine.unitPrice + input.storedSubtotal - estimatedSubtotal),
    );
  }

  return lines;
}

function storedAddonLines(value: unknown): InvoiceLineItem[] {
  if (!value || typeof value !== "object") return [];
  const raw = value as { lines?: unknown };
  if (!Array.isArray(raw.lines)) return [];
  return raw.lines.flatMap((line, index) => {
    if (!line || typeof line !== "object") return [];
    const item = line as Record<string, unknown>;
    return [{
      id: `addon-${index + 1}`,
      description: clean(item.label) || "Party add-on",
      quantity: Math.max(1, money(item.quantity)),
      unitPrice: Math.max(0, money(item.unitPrice)),
    }];
  });
}

async function buildRentalInvoice(bookingId: string): Promise<BookingInvoice | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("id,customer_name,customer_email,customer_phone,rental_item,rental_name,event_date,event_start_time,duration,foam_duration,span_days,event_address,requested_delivery_window,delivery_time,delivery_fee,subtotal,total,setup_location,setup_surface,setup_access,setup_notes")
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: itemRows, error: itemError } = await supabase
    .from("booking_rental_items")
    .select("rental_item,rental_name")
    .eq("booking_id", bookingId);
  if (itemError) throw new Error(itemError.message);
  const items = ((itemRows ?? []) as { rental_item: string; rental_name: string | null }[]);
  const effectiveItems = items.length > 0
    ? items
    : [{ rental_item: String(data.rental_item), rental_name: data.rental_name as string | null }];
  const eventDate = String(data.event_date).slice(0, 10);
  const eventTime = clean(data.event_start_time);
  const deliveryWindow = clean(data.requested_delivery_window) || clean(data.delivery_time);
  const eventAddress = clean(data.event_address);
  const details = [
    eventTime ? `Event time: ${eventTime}` : "",
    deliveryWindow ? `Delivery window: ${deliveryWindow}` : "",
    clean(data.setup_location) ? `Setup location: ${clean(data.setup_location)}` : "",
    clean(data.setup_surface) ? `Surface: ${clean(data.setup_surface)}` : "",
    clean(data.setup_access) ? `Access: ${clean(data.setup_access)}` : "",
  ].filter(Boolean).join("\n");

  return {
    kind: "rental",
    bookingId,
    invoiceNumber: `JJ-R-${bookingId}`,
    invoiceDate: todayYmd(),
    dueDate: eventDate,
    customerName: clean(data.customer_name) || "Guest",
    customerEmail: clean(data.customer_email),
    customerPhone: clean(data.customer_phone),
    billingAddress: eventAddress,
    eventDate,
    eventAddress,
    eventDetails: details,
    lineItems: rentalLines({
      items: effectiveItems,
      duration: clean(data.duration) || "One Day",
      foamDuration: clean(data.foam_duration),
      spanDays: Math.max(1, money(data.span_days) || 1),
      storedSubtotal: money(data.subtotal),
    }),
    deliveryFee: money(data.delivery_fee),
    discount: 0,
    tax: 0,
    paymentsReceived: 0,
    notes: clean(data.setup_notes),
  };
}

async function buildFacilityInvoice(bookingId: string): Promise<BookingInvoice | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("facility_bookings")
    .select("id,customer_name,email,phone,parent_name,child_name,party_label,readable_date,readable_time,start_time,room,party_kind,facility_package_price,addon_subtotal,addon_selections,tax,total,notes")
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const addonLines = storedAddonLines(data.addon_selections);
  if (addonLines.length === 0 && money(data.addon_subtotal) > 0) {
    addonLines.push({
      id: "facility-addons",
      description: "Party add-ons",
      quantity: 1,
      unitPrice: money(data.addon_subtotal),
    });
  }
  const { data: paymentRows, error: paymentError } = await supabase
    .from("facility_party_payments")
    .select("amount")
    .eq("booking_id", bookingId);
  if (paymentError && paymentError.code !== "42P01") throw new Error(paymentError.message);
  const paymentsReceived = (paymentRows ?? []).reduce(
    (sum, row) => sum + money((row as { amount: unknown }).amount),
    0,
  );
  const eventDate = clean(data.readable_date) || String(data.start_time).slice(0, 10);
  return {
    kind: "facility",
    bookingId,
    invoiceNumber: `JJ-F-${bookingId}`,
    invoiceDate: todayYmd(),
    dueDate: String(data.start_time).slice(0, 10),
    customerName: clean(data.customer_name) || clean(data.parent_name) || "Guest",
    customerEmail: clean(data.email),
    customerPhone: clean(data.phone),
    billingAddress: "",
    eventDate,
    eventAddress: BUSINESS_ADDRESS,
    eventDetails: [
      clean(data.readable_time),
      clean(data.room) ? `Room: ${clean(data.room)}` : "",
      clean(data.child_name) ? `Celebrating: ${clean(data.child_name)}` : "",
    ].filter(Boolean).join("\n"),
    lineItems: [
      {
        id: "facility-package",
        description: clean(data.party_label) || "Facility party package",
        quantity: 1,
        unitPrice: money(data.facility_package_price),
      },
      ...addonLines,
    ],
    deliveryFee: 0,
    discount: 0,
    tax: money(data.tax),
    paymentsReceived,
    notes: clean(data.notes),
  };
}

export async function loadBookingInvoice(
  kind: InvoiceKind,
  bookingId: string,
): Promise<BookingInvoice | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("booking_invoices")
    .select("payload")
    .eq("booking_kind", kind)
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (error && error.code !== "42P01") throw new Error(error.message);
  if (kind === "standalone") {
    if (!data?.payload) return null;
    const fallback = data.payload as BookingInvoice;
    return normalizeInvoice(data.payload, fallback);
  }
  const generated = kind === "rental"
    ? await buildRentalInvoice(bookingId)
    : await buildFacilityInvoice(bookingId);
  if (!generated) return null;
  return normalizeInvoice(data?.payload, generated);
}

export type StandaloneInvoiceSummary = {
  bookingId: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  balanceDue: number;
  updatedAt: string;
};

export async function listStandaloneInvoices(): Promise<StandaloneInvoiceSummary[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("booking_invoices")
    .select("booking_id,invoice_number,customer_email,balance_due,updated_at,payload")
    .eq("booking_kind", "standalone")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error?.code === "42P01") return [];
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const payload = row.payload as Partial<BookingInvoice> | null;
    return {
      bookingId: String(row.booking_id),
      invoiceNumber: String(row.invoice_number),
      customerName: clean(payload?.customerName) || "Unnamed customer",
      customerEmail: clean(row.customer_email),
      balanceDue: money(row.balance_due),
      updatedAt: String(row.updated_at),
    };
  });
}

export async function saveBookingInvoice(invoice: BookingInvoice): Promise<void> {
  const normalized = normalizeInvoice(invoice, invoice);
  const totals = calculateInvoiceTotals(normalized);
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("booking_invoices").upsert(
    {
      booking_kind: normalized.kind,
      booking_id: normalized.bookingId,
      invoice_number: normalized.invoiceNumber,
      customer_email: normalized.customerEmail || null,
      payload: normalized,
      subtotal: totals.subtotal,
      total: totals.total,
      balance_due: totals.balanceDue,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "booking_kind,booking_id" },
  );
  if (error) throw new Error(error.message);
}

export async function markInvoiceEmailed(
  kind: InvoiceKind,
  bookingId: string,
): Promise<void> {
  const supabase = createServiceRoleClient();
  await supabase
    .from("booking_invoices")
    .update({ last_emailed_at: new Date().toISOString() })
    .eq("booking_kind", kind)
    .eq("booking_id", bookingId);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

export function invoiceEmailHtml(invoice: BookingInvoice): string {
  const totals = calculateInvoiceTotals(invoice);
  const currency = (value: number) => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
  const rows = invoice.lineItems.map((item) => `
    <tr><td style="padding:10px;border-bottom:1px solid #d9e1ea">${escapeHtml(item.description)}</td><td style="padding:10px;text-align:center;border-bottom:1px solid #d9e1ea">${item.quantity}</td><td style="padding:10px;text-align:right;border-bottom:1px solid #d9e1ea">${currency(item.unitPrice)}</td><td style="padding:10px;text-align:right;border-bottom:1px solid #d9e1ea">${currency(item.quantity * item.unitPrice)}</td></tr>`).join("");
  return `<div style="font-family:Arial,sans-serif;color:#182334;max-width:760px;margin:auto">
    <div style="border-top:8px solid #173b65;border-bottom:3px solid #d93645;padding:18px 0;display:flex;justify-content:space-between">
      <div><img src="https://jumpingjaxllc.com/logo.png" alt="Jumping Jax" style="max-width:220px;max-height:85px"><div style="font-size:13px;color:#627086">559 Beaudrot Road, Greenwood, SC<br>864-933-1420 · info@jumpingjaxllc.com</div></div>
      <div style="font-size:26px;font-weight:bold;color:#d93645">INVOICE</div>
    </div>
    <p><strong>Invoice:</strong> ${escapeHtml(invoice.invoiceNumber)}<br><strong>Invoice date:</strong> ${escapeHtml(invoice.invoiceDate)}<br><strong>Due date:</strong> ${escapeHtml(invoice.dueDate)}</p>
    <div style="display:flex;gap:30px"><p style="flex:1"><strong>Bill to</strong><br>${escapeHtml(invoice.customerName)}<br>${escapeHtml(invoice.customerEmail)}<br>${escapeHtml(invoice.customerPhone)}<br>${escapeHtml(invoice.billingAddress).replace(/\n/g,"<br>")}</p><p style="flex:1"><strong>Event</strong><br>${escapeHtml(invoice.eventDate)}<br>${escapeHtml(invoice.eventAddress).replace(/\n/g,"<br>")}<br>${escapeHtml(invoice.eventDetails).replace(/\n/g,"<br>")}</p></div>
    <table style="width:100%;border-collapse:collapse"><thead><tr style="background:#173b65;color:white"><th style="padding:10px;text-align:left">Description</th><th>Qty</th><th style="text-align:right">Unit price</th><th style="padding:10px;text-align:right">Amount</th></tr></thead><tbody>${rows}</tbody></table>
    <div style="margin-left:auto;width:320px;margin-top:16px"><p>Subtotal: <strong>${currency(totals.subtotal)}</strong></p><p>Delivery fee: <strong>${currency(invoice.deliveryFee)}</strong></p><p>Discount: <strong>-${currency(invoice.discount)}</strong></p><p>Tax: <strong>${currency(invoice.tax)}</strong></p><p>Payments received: <strong>-${currency(invoice.paymentsReceived)}</strong></p><p style="background:#173b65;color:white;padding:12px;font-size:18px">Balance due: <strong>${currency(totals.balanceDue)}</strong></p></div>
    <div style="border-left:4px solid #d93645;padding:10px 14px"><strong>Remit payment to</strong><br>Jumping Jax LLC<br>86 Brock Road<br>Honea Path, SC 29654<br><br><strong>Payment due by the due date shown above. Make checks payable to Jumping Jax LLC and include the invoice number.</strong></div>
    <p style="background:#eef4fa;color:#d93645;text-align:center;font-size:20px;font-weight:bold;padding:14px">Thank you for your business!</p>
  </div>`;
}
