import { NextResponse } from "next/server";

import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { loadTaxExportBookings } from "@/lib/admin/tax-export-load";
import type { TaxExportDateBasis } from "@/lib/admin/tax-export";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function normalizeBasis(value: string | null): TaxExportDateBasis {
  if (value === "created" || value === "payment") return value;
  return "event";
}

export async function GET(req: Request) {
  const limited = rateLimit(req, {
    scope: "admin-tax-export",
    limit: 30,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.reason === "missing_config"
            ? "Owner login is not configured."
            : "Owner authentication required.",
      },
      { status: auth.reason === "missing_config" ? 503 : 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const basis = normalizeBasis(searchParams.get("basis"));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json(
      { error: "Valid from and to dates are required." },
      { status: 400 },
    );
  }

  try {
    const result = await loadTaxExportBookings({ from, to, dateBasis: basis });
    return new NextResponse(result.csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="jumping-jax-bookings-${from}-to-${to}.csv"`,
      },
    });
  } catch (error) {
    console.error("[api/admin/reports/tax-export]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to export bookings.",
      },
      { status: 500 },
    );
  }
}
