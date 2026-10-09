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
    booking_payment_entries: legacy.map(row=>({id:row.id,booking_kind:"facility",booking_id:row.booking_id,amount_cents:Number(row.amount)*100,status:"posted",payment_purpose:"deposit"})),
  };
  const writes: { table: string; row: Row }[] = [];
  const emails: Row[] = [];
  const db = {
    async rpc(_name: string, {p_payment:p}: {p_payment:Row}) {
      const existing=tables.booking_payment_entries.find(r=>r.request_id===p.request_id);
      if(existing) return {data:{outcome:"duplicate",id:existing.id},error:null};
      if(p.payment_purpose==="deposit" && tables.booking_payment_entries.some(r=>r.booking_id===p.booking_id && r.payment_purpose==="deposit")) return {data:{outcome:"deposit_exists"},error:null};
      const row={id:"new-entry",...p,status:"posted"}; tables.booking_payment_entries.push(row); writes.push({table:"booking_payment_entries",row});
      return {data:{outcome:"created",id:row.id},error:null};
    },
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
    async post(kind = "facility", amount = "50.00", overrides: Row = {}) {
      return exports.POST!(new Request("https://example.com/api/payment", {
        method: "POST", body: JSON.stringify({ amount, paymentMethod: "cash", sendReceipt: true, requestId:"11111111-1111-4111-8111-222222222222",payerName:"Actual payer",paidAt:"2026-09-26T12:00:00Z",paymentPurpose:kind === "facility" ? "deposit" : "payment", ...overrides }),
      }), { params: Promise.resolve({ kind, id: kind === "facility" ? bookingId : "123" }) });
    },
  };
}

test("a legacy facility deposit blocks another deposit without writing or emailing", async () => {
  const app = harness([{ id: "legacy", booking_id: bookingId, amount: 50, payment_kind: "deposit", payment_method: "card", paid_at: "2026-09-12T21:36:00Z", recorded_by: "Office" }]);
  const response = await app.post();
  assert.equal(response.status, 409);
  assert.match((await response.json()).message, /already recorded/);
  assert.equal(app.writes.length, 0);
  assert.equal(app.emails.length, 0);
});

test("a facility balance payment after a deposit marks the party paid in full", async () => {
  const app = harness([{ id: "legacy", booking_id: bookingId, amount: 50 }]);
  const response = await app.post("facility", "99.80", { paymentPurpose: "balance" });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.paidCents, 14980);
  assert.equal(result.remainingCents, 0);
  assert.equal(app.writes[0].row.payment_purpose, "balance");
  assert.match(String(app.emails[0].text), /Remaining booking balance: \$0\.00/);
  assert.equal(payments.projectBookingPaymentStatus(149.8, app.tables.booking_payment_entries.map(row => ({ amountCents: Number(row.amount_cents) }))).status, "paid");
  assert.equal((await app.post("facility", "99.80", { paymentPurpose: "balance" })).status, 200);
  assert.equal(app.writes.length, 1, "retry does not credit the balance twice");
});

test("facility full and partial payments are not restricted to the deposit amount", async () => {
  for (const [amount, purpose, remaining] of [["149.80", "balance", 0], ["25.00", "payment", 12480]] as const) {
    const app = harness();
    const response = await app.post("facility", amount, { paymentPurpose: purpose, sendReceipt: false });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).remainingCents, remaining);
    assert.equal(app.emails.length, 0);
  }
});

test("facility deposits still require $50 and card payments still require receipt evidence", async () => {
  const app = harness();
  assert.equal((await app.post("facility", "99.80")).status, 400);
  assert.equal((await app.post("facility", "99.80", { paymentPurpose: "balance", paymentMethod: "card" })).status, 400);
  assert.equal(app.writes.length, 0);
});

test("new deposits use the canonical ledger and receipts use posted balances", async () => {
  const app = harness();
  const response = await app.post();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).remainingCents, 9980);
  assert.equal(app.writes.length, 1);
  assert.equal(app.writes[0].table, "booking_payment_entries");
  assert.equal(app.writes[0].row.amount_cents, 5000);
  assert.equal(app.writes[0].row.payment_purpose, "deposit");
  assert.equal(app.writes[0].row.booking_id, bookingId);
  assert.equal(app.tables.booking_payment_entries.length, 1);
  assert.match(String(app.emails[0].text), /Remaining booking balance: \$99\.80/);
  assert.equal((await app.post()).status, 200);
  assert.equal(app.writes.length, 1);
  assert.equal(app.emails.length, 2); // Durable sender deduplicates the same stable message key.
  assert.equal(app.emails[0].messageKey, app.emails[1].messageKey);
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
