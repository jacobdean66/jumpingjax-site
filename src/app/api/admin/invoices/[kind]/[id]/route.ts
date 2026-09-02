import { NextResponse } from "next/server";

import { verifyAdminAccess } from "@/lib/admin/session";
import { createBlankStandaloneInvoice, normalizeInvoice, type InvoiceKind } from "@/lib/invoices/shared";
import { loadBookingInvoice, saveBookingInvoice } from "@/lib/invoices/store";
import { rateLimit } from "@/lib/rate-limit";

function kindValue(value: string): InvoiceKind | null {
  return value === "rental" || value === "facility" || value === "standalone" ? value : null;
}

function validId(value: string): boolean {
  return value.length > 0 && value.length <= 100 && /^[a-zA-Z0-9-]+$/.test(value);
}

async function authorized() {
  const auth = await verifyAdminAccess();
  return auth.ok ? null : NextResponse.json(
    { ok: false, message: "Admin authentication required." },
    { status: auth.reason === "missing_config" ? 503 : 401 },
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ kind: string; id: string }> },
) {
  const limited = rateLimit(request, {
    scope: "admin-invoice-read",
    limit: 180,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;
  const rejected = await authorized();
  if (rejected) return rejected;
  const params = await context.params;
  const kind = kindValue(params.kind);
  if (!kind || !validId(params.id)) {
    return NextResponse.json({ ok: false, message: "Invalid booking." }, { status: 400 });
  }
  try {
    const invoice = await loadBookingInvoice(kind, params.id);
    if (!invoice) {
      return NextResponse.json({ ok: false, message: "Booking not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, invoice });
  } catch (error) {
    console.error("[admin/invoices] load failed", error);
    return NextResponse.json({ ok: false, message: "Could not load the invoice." }, { status: 503 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ kind: string; id: string }> },
) {
  const limited = rateLimit(request, {
    scope: "admin-invoice-save",
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;
  const rejected = await authorized();
  if (rejected) return rejected;
  const params = await context.params;
  const kind = kindValue(params.kind);
  if (!kind || !validId(params.id)) {
    return NextResponse.json({ ok: false, message: "Invalid booking." }, { status: 400 });
  }
  const current = await loadBookingInvoice(kind, params.id).catch(() => null)
    ?? (kind === "standalone" ? createBlankStandaloneInvoice(params.id) : null);
  if (!current) {
    return NextResponse.json({ ok: false, message: "Booking not found." }, { status: 404 });
  }
  const body = await request.json().catch(() => null);
  const invoice = normalizeInvoice(body, current);
  invoice.kind = kind;
  invoice.bookingId = params.id;
  try {
    await saveBookingInvoice(invoice);
    return NextResponse.json({ ok: true, invoice, message: "Invoice saved." });
  } catch (error) {
    console.error("[admin/invoices] save failed", error);
    return NextResponse.json({ ok: false, message: "Could not save the invoice." }, { status: 503 });
  }
}
