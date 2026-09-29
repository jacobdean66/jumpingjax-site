import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { verifyAdminOwnerAccess } from "@/lib/admin/session";
import { rateLimit } from "@/lib/rate-limit";
import {
  parseSwipeSimpleCsv,
  type SwipeSimpleCsvRow,
} from "@/lib/payments/swipesimple-csv";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const MAX_FILE_BYTES = 2_500_000;

function sameTransaction(
  existing: SwipeSimpleCsvRow,
  incoming: SwipeSimpleCsvRow,
): boolean {
  return existing.transaction_number === incoming.transaction_number &&
    Number(existing.amount_cents) === incoming.amount_cents &&
    existing.result === incoming.result &&
    existing.transaction_type === incoming.transaction_type &&
    new Date(existing.paid_at).toISOString() === incoming.paid_at;
}

export async function POST(request: Request) {
  const auth = await verifyAdminOwnerAccess();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: "Owner sign-in is required to import payment reports." },
      { status: 401 },
    );
  }
  const limited = rateLimit(request, {
    scope: "admin-swipesimple-import",
    limit: 12,
    windowMs: 3_600_000,
  });
  if (limited) return limited;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size < 1 || file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { ok: false, message: "Choose a SwipeSimple CSV file smaller than 2.5 MB." },
      { status: 400 },
    );
  }
  const parsed = parseSwipeSimpleCsv(await file.text());
  if (parsed.errors.length || !parsed.rows.length) {
    return NextResponse.json(
      {
        ok: false,
        message: parsed.errors[0] ?? "No transactions were found in this report.",
        errors: parsed.errors.slice(0, 20),
      },
      { status: 400 },
    );
  }

  const database = createServiceRoleClient();
  const existing = new Map<string, SwipeSimpleCsvRow>();
  for (let offset = 0; offset < parsed.rows.length; offset += 100) {
    const ids = parsed.rows.slice(offset, offset + 100).map((row) => row.transaction_id);
    const { data, error } = await database
      .from("swipesimple_transaction_imports")
      .select("transaction_id,transaction_number,amount_cents,result,transaction_type,paid_at")
      .in("transaction_id", ids);
    if (error) {
      return NextResponse.json(
        { ok: false, message: "Existing payment imports could not be checked. Nothing was imported." },
        { status: 503 },
      );
    }
    for (const row of (data ?? []) as SwipeSimpleCsvRow[]) existing.set(row.transaction_id, row);
  }

  const conflicts = parsed.rows.filter((row) => {
    const prior = existing.get(row.transaction_id);
    return prior ? !sameTransaction(prior, row) : false;
  });
  if (conflicts.length) {
    return NextResponse.json(
      {
        ok: false,
        message: `${conflicts.length} transaction${conflicts.length === 1 ? "" : "s"} conflict with an earlier import. Nothing was imported.`,
        errors: conflicts.slice(0, 20).map((row) => `Transaction ${row.transaction_number}`),
      },
      { status: 409 },
    );
  }

  const newRows = parsed.rows.filter((row) => !existing.has(row.transaction_id));
  for (let offset = 0; offset < newRows.length; offset += 200) {
    const batch = newRows.slice(offset, offset + 200).map((row) => ({
      ...row,
      imported_by: auth.identity.name,
    }));
    const { error } = await database.from("swipesimple_transaction_imports").insert(batch);
    if (error) {
      return NextResponse.json(
        {
          ok: false,
          message: "The report could not be saved. Check Payments before retrying; some earlier batches may already be present.",
        },
        { status: 503 },
      );
    }
  }

  revalidatePath("/admin/payments");
  return NextResponse.json({
    ok: true,
    imported: newRows.length,
    duplicates: parsed.rows.length - newRows.length,
    message: `${newRows.length} new transaction${newRows.length === 1 ? "" : "s"} imported. ${parsed.rows.length - newRows.length} already present.`,
  });
}

