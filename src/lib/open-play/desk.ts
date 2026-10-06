import type { AdmissionClassification } from "./pricing";

export type DeskPerson = {
  id: string;
  business_day_ymd: string;
  source: "native" | "legacy_smartwaiver";
  participant_id: string | null;
  legacy_participant_id: string | null;
  identity_key: string;
  first_name: string;
  last_name: string;
  dob: string | null;
  role: "child" | "adult_signer" | "adult_covered";
  waiver_expires_on: string;
  checked_in_at: string;
  checked_out_at: string | null;
  created_by_staff_id: string;
  facility_party_booking_id?: string;
};
export type DeskItem = {
  id: string; ticket_id: string; attendance_id: string;
  classification: AdmissionClassification | null;
  amount_cents: number | null; credited_cents: number; reason: string;
};
export type DeskPayment = {
  id: string; ticket_id: string; method: "cash" | "card";
  amount_cents: number; reference: string; created_at: string; created_by_staff_id: string;
  entry_type?: "payment" | "void"; related_payment_id?: string | null; reason?: string;
};
export type DeskTicket = {
  id: string; business_day_ymd: string; payer_name: string; created_at: string;
  created_by_staff_id: string; items: DeskItem[]; payments: DeskPayment[];
};
export type DeskState = { people: DeskPerson[]; tickets: DeskTicket[] };

export function dollarsToCents(value: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function ticketTotals(ticket: DeskTicket) {
  const total = ticket.items.reduce((sum, item) => sum + (item.amount_cents ?? 0), 0);
  const credit = ticket.items.reduce((sum, item) => sum + Math.min(item.amount_cents ?? 0, item.credited_cents), 0);
  const paid = ticket.payments.reduce((sum, payment) => sum + payment.amount_cents, 0);
  return { total, credit, paid, due: Math.max(0, total - credit - paid), ready: ticket.items.length > 0 && ticket.items.every(item => item.classification !== null && item.amount_cents !== null) };
}

export function personIdentity(first: string, last: string, dob: string) {
  return `${first.trim().replace(/\s+/g, " ").toLowerCase()}|${last.trim().replace(/\s+/g, " ").toLowerCase()}|${dob}`;
}

/** Allocate actual receipt money to admission lines without recording it twice. */
export function allocateTicketPayments(ticket: DeskTicket) {
  const remaining = new Map(ticket.items.map(item => [item.id, Math.max(0, (item.amount_cents ?? 0) - item.credited_cents)]));
  const allocations = new Map<string, Array<{ item: DeskItem; amount: number }>>();
  return ticket.payments.flatMap(payment => {
    if (payment.entry_type === "void") {
      return (allocations.get(payment.related_payment_id ?? "") ?? []).map(({ item, amount }) => {
        remaining.set(item.id, (remaining.get(item.id) ?? 0) + amount);
        return { payment, item, amount: -amount };
      });
    }
    let unallocated = payment.amount_cents;
    return ticket.items.flatMap(item => {
      const amount = Math.min(unallocated, remaining.get(item.id) ?? 0);
      if (!amount) return [];
      remaining.set(item.id, (remaining.get(item.id) ?? 0) - amount);
      unallocated -= amount;
      const saved = allocations.get(payment.id) ?? []; saved.push({ item, amount }); allocations.set(payment.id, saved);
      return [{ payment, item, amount }];
    });
  });
}
