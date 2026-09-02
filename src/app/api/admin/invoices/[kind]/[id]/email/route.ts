import { NextResponse } from "next/server";
import { Resend } from "resend";

import { verifyAdminAccess } from "@/lib/admin/session";
import { getResendFromAddress } from "@/lib/email/resend";
import type { InvoiceKind } from "@/lib/invoices/shared";
import {
  invoiceEmailHtml,
  loadBookingInvoice,
  markInvoiceEmailed,
} from "@/lib/invoices/store";
import { rateLimit } from "@/lib/rate-limit";

function kindValue(value: string): InvoiceKind | null {
  return value === "rental" || value === "facility" || value === "standalone" ? value : null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ kind: string; id: string }> },
) {
  const limited = rateLimit(request, {
    scope: "admin-invoice-email",
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;
  const auth = await verifyAdminAccess();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: "Admin authentication required." },
      { status: auth.reason === "missing_config" ? 503 : 401 },
    );
  }
  const { kind: rawKind, id } = await context.params;
  const kind = kindValue(rawKind);
  if (!kind || !id) {
    return NextResponse.json({ ok: false, message: "Invalid booking." }, { status: 400 });
  }
  const invoice = await loadBookingInvoice(kind, id).catch(() => null);
  if (!invoice) {
    return NextResponse.json({ ok: false, message: "Invoice not found." }, { status: 404 });
  }
  const body = await request.json().catch(() => null) as { target?: unknown } | null;
  const target = body?.target === "office" ? "office" : "customer-and-office";
  const officeEmail = process.env.INVOICE_OFFICE_EMAIL?.trim() || "info@jumpingjaxllc.com";
  if (target === "customer-and-office" && (!invoice.customerEmail || !/^\S+@\S+\.\S+$/.test(invoice.customerEmail))) {
    return NextResponse.json(
      { ok: false, message: "Add a valid customer email before sending." },
      { status: 400 },
    );
  }
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ ok: false, message: "Invoice email is not configured." }, { status: 503 });
  }
  try {
    const resend = new Resend(apiKey);
    const to = target === "office" ? officeEmail : invoice.customerEmail;
    const { error } = await resend.emails.send({
      from: getResendFromAddress(),
      to,
      bcc: target === "customer-and-office" && invoice.customerEmail.toLowerCase() !== officeEmail.toLowerCase()
        ? officeEmail
        : undefined,
      subject: `${target === "office" ? "Office copy — " : ""}Jumping Jax invoice ${invoice.invoiceNumber}`,
      html: invoiceEmailHtml(invoice),
      text: `Jumping Jax invoice ${invoice.invoiceNumber}. Amount details are included in this email. Thank you for your business!`,
    });
    if (error) throw error;
    await markInvoiceEmailed(kind, id);
    return NextResponse.json({
      ok: true,
      message: target === "office"
        ? `Office copy emailed to ${officeEmail}.`
        : `Invoice emailed to ${invoice.customerEmail}, with an office copy to ${officeEmail}.`,
    });
  } catch (error) {
    console.error("[admin/invoices] email failed", error);
    return NextResponse.json({ ok: false, message: "The invoice email could not be sent." }, { status: 503 });
  }
}
