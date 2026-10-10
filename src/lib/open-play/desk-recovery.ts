import { ticketTotals, type DeskState, type DeskTicket } from "./desk";

export type PendingDeskCheckout = {
  key: string;
  id: string;
  ticketId: string;
  method: "cash" | "card" | null;
  passes: string[];
  birthdayPartyId?: string | null;
};

export function checkoutRequestKey(
  ticketId: string,
  method: PendingDeskCheckout["method"],
  passes: string[],
  birthdayPartyId?: string | null,
) {
  return JSON.stringify(birthdayPartyId
    ? [ticketId, method, [...passes].sort(), birthdayPartyId]
    : [ticketId, method, [...passes].sort()]);
}

export function parsePendingDeskCheckout(raw: string | null): PendingDeskCheckout | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as PendingDeskCheckout;
    if (!value || typeof value.id !== "string" || value.id.length < 16 ||
      typeof value.ticketId !== "string" || !value.ticketId ||
      !["cash", "card", null].includes(value.method) ||
      !Array.isArray(value.passes) || !value.passes.every(id => typeof id === "string") ||
      (value.birthdayPartyId != null && (typeof value.birthdayPartyId !== "string" || !value.birthdayPartyId)) ||
      value.key !== checkoutRequestKey(value.ticketId, value.method, value.passes, value.birthdayPartyId)) return null;
    return value;
  } catch { return null; }
}

/** Completed and older fully paid receipts belong in the receipt viewer. */
export function isDeskTicketClosed(ticket: DeskTicket) {
  const totals = ticketTotals(ticket);
  return !!ticket.completed_at || (totals.ready && totals.paid > 0 && totals.due === 0);
}

export function recoverDeskSelection(
  state: DeskState,
  selectedId: string | null,
  pending: PendingDeskCheckout | null,
) {
  const id = pending?.ticketId ?? selectedId;
  const ticket = state.tickets.find(ticket => ticket.id === id);
  if (!id) return { ticketId: null, pending: null, reason: "empty" as const };
  if (!ticket) return { ticketId: null, pending: null, reason: "missing" as const };
  if (isDeskTicketClosed(ticket)) {
    return { ticketId: null, pending: null, reason: "closed" as const };
  }
  return { ticketId: ticket.id, pending, reason: "open" as const };
}

export class DeskRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

/** A timed-out write can still have saved; its checkout id must be retained. */
export async function deskRequest<T>(
  path: string,
  options: RequestInit = {},
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 20000,
): Promise<T> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  let response: Response;
  try { response = await fetchImpl(path, { ...options, signal, cache: "no-store" }); }
  catch (error) {
    if (options.signal?.aborted) throw error;
    throw new DeskRequestError("The desk could not connect. Refresh to check what saved before retrying.", 0);
  }
  let body: { ok?: boolean; error?: string } & T;
  try { body = await response.json(); }
  catch { throw new DeskRequestError("The desk returned an incomplete response. Refresh to check what saved before retrying.", response.ok ? 0 : response.status); }
  if (!body || typeof body !== "object") throw new DeskRequestError("The desk returned an incomplete response. Refresh to check what saved before retrying.", 0);
  if (!response.ok || body.ok !== true) {
    throw new DeskRequestError(
      response.status === 401 ? "Your staff sign-in expired. Sign in again, then reopen the desk. Saved attendance and receipts are kept."
        : body.error || "Unable to save. Refresh to check the saved state before retrying.",
      response.status,
    );
  }
  return body;
}
