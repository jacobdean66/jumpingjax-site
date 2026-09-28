import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as payments from "./booking-payments";

const bookingId = "11111111-1111-4111-8111-111111111111";
type Row = Record<string, unknown>;

function harness(legacy: Row[] = []) {
  const tables: Record<string, Row[]> = {
    facility_bookings: [{ id: bookingId, total: 149.8, email: "customer@example.com" }],
    bookings: [{ id: "123", total: 100, customer_email: "customer@example.com" }],
    facility_party_payments: [...legacy],
    booking_payment_entries: [],
  };
  const writes: { table: string; row: Row }[] = [];
  const emails: Row[] = [];
  const db = {
    from(table: string) {
      const filters: [string, unknown][] = [];
      let pending: Row | null = null;
      const result = () => {
        if (pending) {
          if (tables[table].some((row) => row.id === pending!.id)) {
            return { data: null, error: { code: "23505" } };
          }
          const row = { id: "new-entry", ...pending };
          tables[table].push(row);
          writes.push({ table, row });
          return { data: row, error: null };
        }
        return { data: tables[table].filter((row) => filters.every(([key, value]) => row[key] === value)), error: null };
      };
      const query = {
        select() { return query; },
        eq(key: string, value: unknown) { filters.push([key, value]); return query; },
        insert(row: Row) { pending = row; return query; },
        update() { return query; },
        async maybeSingle() { const response = result(); return { ...response, data: (response.data as Row[])?.[0] ?? null }; },
        async single() { return result(); },
        then(resolve: (value: ReturnType<typeof result>) => unknown) { return Promise.resolve(result()).then(resolve); },
      };
      return query;
    },
  };
  const imports: Record<string, unknown> = {
    "next/cache": { revalidatePath() {} },
    "next/server": { NextResponse: Response },
    "@/lib/admin/session": { verifyAdminAccess: async () => ({ ok: true, identity: { name: "Test staff" } }) },
    "@/lib/bookings/durable-email": { sendDurableBookingEmail: async (input: Row) => { emails.push(input); return { error: null }; } },
    "@/lib/payments/booking-payments": payments,
    "@/lib/rate-limit": { rateLimit: () => null },
    "@/lib/supabase/admin": { createServiceRoleClient: () => db },
  };
  // Execute the real route with isolated database/email substitutes; no network is used.
  const compiled = ts.transpileModule(readFileSync(new URL("../../app/api/admin/bookings/[kind]/[id]/payments/route.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: { POST?: (req: Request, context: unknown) => Promise<Response> } = {};
  runInNewContext(compiled, { exports, require: (name: string) => {
    assert.ok(name in imports, `Unexpected dependency: ${name}`);
    return imports[name];
  }, console });
  return {
    tables, writes, emails,
    async post(kind = "facility", amount = "50.00") {
      return exports.POST!(new Request("https://example.com/api/payment", {
        method: "POST", body: JSON.stringify({ amount, paymentMethod: "cash", sendReceipt: true }),
      }), { params: Promise.resolve({ kind, id: kind === "facility" ? bookingId : "123" }) });
    },
  };
}

test("a legacy facility deposit blocks another payment without writing or emailing", async () => {
  const app = harness([{ id: "legacy", booking_id: bookingId, amount: 50, payment_kind: "deposit", payment_method: "card", paid_at: "2026-09-12T21:36:00Z", recorded_by: "Office" }]);
  const response = await app.post();
  assert.equal(response.status, 409);
  assert.equal((await response.json()).remainingCents, 9980);
  assert.equal(app.writes.length, 0);
  assert.equal(app.emails.length, 0);
});

test("new facility deposits use the agreement ledger and receipts use posted balances", async () => {
  const app = harness();
  const response = await app.post();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).remainingCents, 9980);
  assert.equal(app.writes.length, 1);
  assert.equal(app.writes[0].table, "facility_party_payments");
  assert.equal(app.writes[0].row.amount, 50);
  assert.equal(app.writes[0].row.payment_kind, "deposit");
  assert.equal(app.writes[0].row.id, bookingId);
  assert.equal(app.tables.booking_payment_entries.length, 0);
  assert.match(String(app.emails[0].text), /Remaining booking balance: \$99\.80/);
  assert.equal((await app.post()).status, 409);
  assert.equal(app.writes.length, 1);
  assert.equal(app.emails.length, 1);
});

test("rental payments retain their ledger and partial-payment balance", async () => {
  const app = harness();
  const response = await app.post("rental", "25.00");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).remainingCents, 7500);
  assert.equal(app.writes[0].table, "booking_payment_entries");
  assert.equal(app.writes[0].row.amount_cents, 2500);
  assert.equal(app.tables.facility_party_payments.length, 0);
});
