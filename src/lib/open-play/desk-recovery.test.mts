import assert from "node:assert/strict";
import test from "node:test";
import {
  checkoutRequestKey, deskRequest, DeskRequestError, parsePendingDeskCheckout,
  recoverDeskSelection, type PendingDeskCheckout,
} from "./desk-recovery.ts";
import type { DeskState, DeskTicket } from "./desk.ts";

function ticket(overrides: Partial<DeskTicket> = {}): DeskTicket {
  return {
    id: "ticket-1", business_day_ymd: "2026-10-08", payer_name: "",
    created_at: "2026-10-08T12:00:00Z", created_by_staff_id: "staff",
    items: [{ id: "item-1", ticket_id: "ticket-1", attendance_id: "person-1", classification: "child_3_plus", amount_cents: 1000, credited_cents: 0, reason: "" }],
    payments: [], ...overrides,
  };
}
const state = (t: DeskTicket): DeskState => ({ people: [], tickets: [t] });
const pending: PendingDeskCheckout = {
  ticketId: "ticket-1", id: "unchanged-checkout-request-id", method: "card", passes: [],
  key: checkoutRequestKey("ticket-1", "card", []),
};
const payment = { id: "payment-1", ticket_id: "ticket-1", method: "card" as const, amount_cents: 1000, reference: "", created_at: "2026-10-08T12:01:00Z", created_by_staff_id: "staff" };

test("reopening a completed receipt returns to the next customer without changing its records", () => {
  const saved = state(ticket({ completed_at: "2026-10-08T12:01:00Z", payments: [payment] }));
  const before = structuredClone(saved);
  assert.deepEqual(recoverDeskSelection(saved, "ticket-1", null), { ticketId: null, pending: null, reason: "closed" });
  assert.deepEqual(saved, before);
});
test("a lost checkout response is reconciled from the saved completed receipt", () => {
  assert.deepEqual(recoverDeskSelection(state(ticket({ completed_at: "2026-10-08T12:01:00Z" })), "another-ticket", pending), { ticketId: null, pending: null, reason: "closed" });
});
test("an all-free completed ticket also resets even without a payment", () => {
  const free = ticket({ completed_at: "2026-10-08T12:01:00Z" });
  free.items[0].credited_cents = 1000;
  assert.equal(recoverDeskSelection(state(free), free.id, pending).reason, "closed");
});
test("older manager receipts that are fully paid cannot trap the active checkout", () => {
  assert.equal(recoverDeskSelection(state(ticket({ payments: [payment] })), "ticket-1", null).reason, "closed");
});
test("partial payment remains open to finish its balance", () => {
  assert.equal(recoverDeskSelection(state(ticket({ payments: [{ ...payment, amount_cents: 500 }] })), "ticket-1", null).reason, "open");
});
test("unconfirmed checkout restores the exact id, payment choice and passes", () => {
  const result = recoverDeskSelection(state(ticket()), null, pending);
  assert.equal(result.ticketId, pending.ticketId);
  assert.equal(result.pending, pending);
  assert.deepEqual(parsePendingDeskCheckout(JSON.stringify(pending)), pending);
});
test("fully covered but uncompleted tickets remain available for completion", () => {
  const free = ticket(); free.items[0].credited_cents = 1000;
  assert.equal(recoverDeskSelection(state(free), free.id, pending).reason, "open");
});
test("a missing or old-day ticket does not restore a phantom checkout", () => {
  assert.equal(recoverDeskSelection({ people: [], tickets: [] }, "ticket-1", null).reason, "missing");
});
test("corrupt or changed checkout retry data is rejected", () => {
  for (const raw of ["invalid", "null", "{}", JSON.stringify({ ...pending, passes: "bad" }), JSON.stringify({ ...pending, method: "cash" }), JSON.stringify({ ...pending, id: 9 })]) {
    assert.equal(parsePendingDeskCheckout(raw), null);
  }
});
test("request reports rejected validation distinctly from uncertain writes", async () => {
  await assert.rejects(deskRequest("/desk", {}, async () => Response.json({ ok: false, error: "Invalid pass" }, { status: 400 })), error => error instanceof DeskRequestError && error.status === 400 && error.message === "Invalid pass");
  await assert.rejects(deskRequest("/desk", {}, async () => { throw new TypeError("connection lost"); }), error => error instanceof DeskRequestError && error.status === 0 && /check what saved/.test(error.message));
});
test("a hung request ends and keeps the outcome uncertain for safe checkout recovery", async () => {
  const keepAlive = setInterval(() => {}, 1000);
  try {
    await assert.rejects(deskRequest("/desk", {}, async (_url, options) => new Promise((_resolve, reject) => {
      options!.signal!.addEventListener("abort", () => reject(options!.signal!.reason), { once: true });
    }), 10), error => error instanceof DeskRequestError && error.status === 0);
  } finally { clearInterval(keepAlive); }
});
test("expired sign-in and invalid JSON give actionable errors", async () => {
  await assert.rejects(deskRequest("/desk", {}, async () => Response.json({ ok: false }, { status: 401 })), /sign-in expired/);
  await assert.rejects(deskRequest("/desk", {}, async () => new Response("incomplete")), error => error instanceof DeskRequestError && error.status === 0);
  await assert.rejects(deskRequest("/desk", {}, async () => Response.json(null)), /incomplete response/);
});
