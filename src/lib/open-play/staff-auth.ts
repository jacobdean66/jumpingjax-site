import { NextResponse } from "next/server";

import type { AdminDeliveryAuthResult } from "@/lib/admin/delivery-auth";
import { verifyAdminAccess } from "@/lib/admin/session";

type AuthOk = Extract<AdminDeliveryAuthResult, { ok: true }>;

export async function requireStaffAuth(): Promise<
  | { ok: true; auth: AuthOk }
  | { ok: false; response: NextResponse }
> {
  const auth = await verifyAdminAccess();
  if (!auth.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "Staff authentication required",
          code: "unauthorized",
        },
        { status: auth.reason === "missing_config" ? 503 : 401 },
      ),
    };
  }
  return { ok: true, auth };
}

/**
 * Owner-only gate that distinguishes authenticated employees (403) from
 * unauthenticated callers (401).
 */
export async function requireOwnerAuth(): Promise<
  | { ok: true; auth: AuthOk }
  | { ok: false; response: NextResponse }
> {
  const staff = await requireStaffAuth();
  if (!staff.ok) return staff;
  if (staff.auth.role !== "owner") {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "Owner access required",
          code: "forbidden",
        },
        { status: 403 },
      ),
    };
  }
  return staff;
}

export function publicSafeError(
  code: string,
  status: number,
  message = "Request could not be completed",
): NextResponse {
  return NextResponse.json(
    { ok: false, error: message, code },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}
