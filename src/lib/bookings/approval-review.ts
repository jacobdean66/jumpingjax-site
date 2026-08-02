import { verifyAdminAccess } from "@/lib/admin/session";
import {
  type ApprovalAction,
  type ApprovalBookingKind,
  verifyApprovalToken,
} from "./approval-token";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type BookingDecision = {
  bookingId: string;
  action: ApprovalAction | "cancel" | "uncancel";
};

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Type": "text/html; charset=utf-8",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function approvalErrorResponse(reason: string, status = 401): Response {
  const expired = reason === "expired";
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Approval link unavailable</title></head><body style="font-family:system-ui;max-width:42rem;margin:4rem auto;padding:1.5rem"><h1>${expired ? "This approval link has expired" : "This approval link is not valid"}</h1><p>${expired ? "Open the Jumping Jax admin dashboard to review this pending booking and issue a current decision." : "The link may have been modified or replaced. No booking was changed."}</p><p><a href="/admin">Open the admin dashboard</a></p></body></html>`,
    { status, headers: PRIVATE_HEADERS },
  );
}

export async function renderApprovalReview(input: {
  bookingKind: ApprovalBookingKind;
  token: string | null;
  postPath: string;
}): Promise<Response> {
  const verified = verifyApprovalToken(input.token, {
    bookingKind: input.bookingKind,
  });
  if (!verified.ok) return approvalErrorResponse(verified.reason);

  const actionLabel = verified.claims.action === "confirm" ? "Approve" : "Reject";
  const kindLabel = input.bookingKind === "facility" ? "facility party" : "rental";
  const supabase = createServiceRoleClient();
  const table = input.bookingKind === "facility" ? "facility_bookings" : "bookings";
  const fields =
    input.bookingKind === "facility"
      ? "status,customer_name,parent_name,child_name,party_label,readable_date,readable_time,room,total"
      : "status,customer_name,rental_name,event_date,duration,event_address,total";
  const { data: booking, error } = await supabase
    .from(table)
    .select(fields)
    .eq("id", verified.claims.bookingId)
    .maybeSingle<Record<string, unknown>>();
  if (error || !booking) return approvalErrorResponse("booking_unavailable", 404);
  const detailRows = Object.entries(booking)
    .filter(([, value]) => value !== null && value !== "")
    .map(([key, value]) =>
      `<dt style="font-weight:700">${escapeHtml(key.replaceAll("_", " "))}</dt><dd style="margin:0 0 .75rem">${escapeHtml(String(value))}</dd>`,
    )
    .join("");
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Review ${escapeHtml(kindLabel)}</title></head><body style="font-family:system-ui;max-width:42rem;margin:4rem auto;padding:1.5rem"><p style="font-weight:700;color:#0369a1">Jumping Jax secure review</p><h1>${actionLabel} this ${escapeHtml(kindLabel)}?</h1><p>Booking reference: <strong>${escapeHtml(verified.claims.bookingId)}</strong></p><dl style="background:#f8fafc;padding:1rem;border-radius:.75rem">${detailRows}</dl><p>Opening this page has not changed the booking. Press the button below to make the decision.</p><form method="post" action="${escapeHtml(input.postPath)}?token=${encodeURIComponent(input.token!)}"><button type="submit" style="font:inherit;font-weight:700;padding:.8rem 1.2rem;border:0;border-radius:999px;background:#0f172a;color:white">${actionLabel} booking</button></form><p><a href="/admin">Cancel and open admin</a></p></body></html>`,
    { headers: PRIVATE_HEADERS },
  );
}

export async function resolveDecisionRequest(
  req: Request,
  bookingKind: ApprovalBookingKind,
  options?: { allowCancel?: boolean },
): Promise<
  | { ok: true; decision: BookingDecision; authorization: "token" | "admin" }
  | { ok: false; response: Response }
> {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (token) {
    const verified = verifyApprovalToken(token, { bookingKind });
    if (!verified.ok) {
      return { ok: false, response: approvalErrorResponse(verified.reason) };
    }
    return {
      ok: true,
      authorization: "token",
      decision: {
        bookingId: verified.claims.bookingId,
        action: verified.claims.action,
      },
    };
  }

  const auth = await verifyAdminAccess();
  if (!auth.ok) {
    return {
      ok: false,
      response: approvalErrorResponse("admin_auth_required", 401),
    };
  }
  const bookingId = searchParams.get("id");
  const action = searchParams.get("action");
  const actionAllowed =
    action === "confirm" ||
    action === "reject" ||
    (options?.allowCancel === true &&
      (action === "cancel" || action === "uncancel"));
  if (!bookingId || !actionAllowed) {
    return { ok: false, response: approvalErrorResponse("invalid", 400) };
  }
  return {
    ok: true,
    authorization: "admin",
    decision: { bookingId, action: action as BookingDecision["action"] },
  };
}
