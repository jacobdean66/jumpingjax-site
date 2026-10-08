"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatCents } from "@/lib/open-play/check-in-client";
import {
  checkoutRequestKey, deskRequest, DeskRequestError, isDeskTicketClosed,
  parsePendingDeskCheckout, recoverDeskSelection, type PendingDeskCheckout,
} from "@/lib/open-play/desk-recovery";
import {
  ticketTotals,
  personIdentity,
  type DeskState,
  type DeskItem,
  type DeskPerson,
} from "@/lib/open-play/desk";
import type {
  StaffSearchResult,
  StaffWaiverParticipant,
} from "@/lib/waivers/search";
import {
  EditWaiverNameDialog,
  type EditableWaiverName,
} from "@/components/open-play/EditWaiverNameDialog";
import { WaiverDeskManager } from "./WaiverDeskManager";
type Guest = StaffSearchResult | StaffWaiverParticipant;
const primary =
  "min-h-12 rounded-xl bg-emerald-700 px-5 py-3 font-black text-white disabled:opacity-50";
const secondary =
  "min-h-11 rounded-xl border-2 border-slate-300 bg-white px-4 py-2 font-bold text-slate-900 disabled:opacity-50";
const idFor = (g: Guest) =>
  g.source === "legacy_smartwaiver" ? g.legacyParticipantId : g.participantId;
export function WaiverDeskClient({
  day,
  initial,
  isOwner = false,
  readOnly = false,
}: {
  day: string;
  initial: DeskState | null;
  isOwner?: boolean;
  readOnly?: boolean;
}) {
  const [state, setState] = useState<DeskState>(
    initial ?? { people: [], tickets: [] },
  );
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<StaffSearchResult[]>([]),
    [group, setGroup] = useState<Guest[] | null>(null);
  const [loading, setLoading] = useState(false),
    [groupLoading, setGroupLoading] = useState(false),
    [recovering, setRecovering] = useState(true),
    [pendingCheckout, setPendingCheckout] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(
      initial ? "" : "Refresh to load the check-in desk.",
    );
  const [message, setMessage] = useState(""),
    [ticketId, setTicketId] = useState<string | null>(null),
    [stage, setStage] = useState<"search" | "checkout">("search");
  const [method, setMethod] = useState<"cash" | "card" | null>(null),
    [passes, setPasses] = useState<string[]>([]),
    [showPasses, setShowPasses] = useState(false),
    [manage, setManage] = useState(false);
  const [nameTarget, setNameTarget] = useState<EditableWaiverName | null>(null);
  const input = useRef<HTMLInputElement>(null),
    lock = useRef(false),
    createId = useRef<string | null>(null),
    attempt = useRef<PendingDeskCheckout | null>(null),
    selectedTicket = useRef<string | null>(null),
    readVersion = useRef(0),
    groupController = useRef<AbortController | null>(null);
  const storageKey = `jumpingjax:desk-ticket:${day}`;
  const ticket = state.tickets.find((t) => t.id === ticketId) ?? null;
  const base = ticket ? ticketTotals(ticket) : null;
  const personFor = (item: DeskItem) =>
    state.people.find((p) => p.id === item.attendance_id);
  const passValue = (item: DeskItem) =>
    Math.min(
      item.amount_cents ?? 0,
      item.classification === "child_2_or_under"
        ? 700
        : item.classification === "watching_adult"
          ? 0
          : 1000,
    );
  const deduction =
    ticket?.items.reduce(
      (sum, item) =>
        sum +
        (passes.includes(item.id)
          ? Math.min(
              passValue(item),
              Math.max(0, (item.amount_cents ?? 0) - item.credited_cents),
            )
          : 0),
      0,
    ) ?? 0;
  const due = Math.max(0, (base?.due ?? 0) - deduction);
  const chooseTicket = useCallback((id: string | null) => {
    selectedTicket.current = id;
    setTicketId(id);
    setPasses([]);
    setMethod(null);
    attempt.current = null;
    setPendingCheckout(false);
    try {
      if (id) window.localStorage.setItem(storageKey, id);
      else window.localStorage.removeItem(storageKey);
      window.localStorage.removeItem(storageKey + ":checkout");
    } catch { /* Browser storage may be unavailable; keep the selection in memory. */ }
  }, [storageKey]);
  const resetCheckout = useCallback(() => {
    groupController.current?.abort();
    createId.current = null;
    chooseTicket(null);
    setQuery("");
    setResults([]);
    setGroup(null);
    setLoading(false);
    setGroupLoading(false);
    setStage("search");
    setShowPasses(false);
  }, [chooseTicket]);
  const refresh = useCallback(async () => {
    const version = ++readVersion.current;
    const body = await deskRequest<{ state: DeskState }>(`/api/admin/open-play/desk?date=${day}`);
    if (version === readVersion.current) {
      setState(body.state);
      setError(current => current === "Refresh to load the check-in desk." || current.startsWith("Live refresh failed.") ? "" : current);
      const recovered = recoverDeskSelection(body.state, selectedTicket.current, attempt.current);
      if (recovered.reason === "closed" || recovered.reason === "missing") {
        resetCheckout();
        if (recovered.reason === "closed") setError("");
        setMessage(recovered.reason === "closed"
          ? "The previous checkout is already saved. Ready for the next customer. View its receipt under Manage saved attendance and receipts."
          : "The previous ticket is unavailable. Ready for a new checkout; review saved attendance before adding guests.");
      }
      setRecovering(false);
    }
    return body.state;
  }, [day, resetCheckout]);
  useEffect(() => {
    let saved: string | null = null;
    let restored: PendingDeskCheckout | null = null;
    try {
      saved = window.localStorage.getItem(storageKey);
      restored = parsePendingDeskCheckout(window.localStorage.getItem(storageKey + ":checkout"));
    } catch { /* Continue when browser storage is unavailable. */ }
    selectedTicket.current = restored?.ticketId ?? saved;
    attempt.current = restored;
    void Promise.resolve().then(() => {
      setTicketId(selectedTicket.current);
      setPendingCheckout(!!restored);
      if (restored) {
        setMethod(restored.method);
        setPasses(restored.passes);
        setShowPasses(restored.passes.length > 0);
        setStage("checkout");
      }
    });
    void refresh().catch(e => setError(e.message));
    const interval = window.setInterval(() => {
      if (!lock.current)
        void refresh().catch(() =>
          setError(
            "Live refresh failed. Use Refresh before completing checkout.",
          ),
        );
    }, 20000);
    return () => {
      window.clearInterval(interval);
      groupController.current?.abort();
    };
  }, [refresh, storageKey]);
  useEffect(() => {
    const controller = new AbortController();
    if (!query.trim() || stage !== "search") return () => controller.abort();
    const timer = window.setTimeout(() => {
      void deskRequest<{ results: StaffSearchResult[] }>(
        `/api/admin/open-play/waivers/search?q=${encodeURIComponent(query.trim())}`,
        { signal: controller.signal },
      )
        .then((r) => {
          if (!controller.signal.aborted) {
            setResults(r.results);
            setLoading(false);
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted) {
            setError(e.message || "Search failed.");
            setLoading(false);
          }
        });
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, stage]);
  async function command(action: string, payload: Record<string, unknown>) {
    const body = await deskRequest<{ result: { ticketId?: string; attendanceId?: string } }>("/api/admin/open-play/desk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, date: day, action }),
    });
    return body.result;
  }
  async function mutate(action: string, payload: Record<string, unknown>) {
    if (lock.current || readOnly || recovering || attempt.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await command(action, payload);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function presenceFor(g: Guest) {
    const identity = g.dobYmd
      ? personIdentity(
          g.originalFirstName || g.firstName,
          g.originalLastName || g.lastName,
          g.dobYmd,
        )
      : null;
    return state.people.find(
      (p) =>
        (p.source === g.source &&
          (p.participant_id ?? p.legacy_participant_id) === idFor(g)) ||
        (identity && p.identity_key === identity),
    );
  }
  async function openGroup(result: StaffSearchResult) {
    setError("");
    groupController.current?.abort();
    setGroup(null);
    setGroupLoading(false);
    if (result.source === "legacy_smartwaiver") {
      setGroup(
        result.waiverParticipants?.length
          ? result.waiverParticipants
          : [result],
      );
      return;
    }
    const controller = new AbortController();
    groupController.current = controller;
    setGroupLoading(true);
    try {
      const body = await deskRequest<{ members: Guest[] }>(
        `/api/admin/open-play/waivers/groups/${encodeURIComponent(result.submissionId)}`,
        { cache: "no-store", signal: controller.signal },
      );
      if (!controller.signal.aborted) {
        setGroup(body.members);
        setGroupLoading(false);
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(e instanceof Error ? e.message : "Unable to open the group.");
        setGroupLoading(false);
      }
    }
  }
  async function add(g: Guest) {
    if (lock.current || readOnly || recovering || attempt.current || !idFor(g)) return;
    if (g.expired || !g.checkInEligible) {
      setError(
        "A current waiver with a date of birth is required before admission.",
      );
      return;
    }
    if ((ticket?.items.length ?? 0) >= 40) {
      setError("Complete this checkout before adding more than 40 guests.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const before = await refresh();
      const identity = g.dobYmd ? personIdentity(g.originalFirstName || g.firstName, g.originalLastName || g.lastName, g.dobYmd) : null;
      const existingArrival = before.people.find(p =>
        (p.source === g.source && (p.participant_id ?? p.legacy_participant_id) === idFor(g)) ||
        (identity && p.identity_key === identity));
      const existingTicket = before.tickets.find(t => t.items.some(i => i.attendance_id === existingArrival?.id));
      if (existingTicket) {
        setMessage(`${g.fullName} already has saved attendance and a checkout ticket. Review it under Manage saved attendance and receipts. Your current checkout is kept.`);
        return;
      }
      let target = selectedTicket.current;
      const active = before.tickets.find(t => t.id === target);
      if (active && ticketTotals(active).paid > 0) {
        setError("This ticket already has a payment. Finish its balance or use Next customer to start another checkout.");
        return;
      }
      if (!target) {
        createId.current ??= crypto.randomUUID();
        const made = await command("create_ticket", {
          ticketId: createId.current,
        });
        target = made.ticketId!;
        chooseTicket(target);
        createId.current = null;
      }
      const saved = await command("add", {
        ticketId: target,
        source: g.source,
        participantId: idFor(g),
      });
      let latest = await refresh();
      // Another desk may have added this guest while the request was in flight.
      // Never replace the current group with that guest's old receipt.
      if (saved.ticketId && saved.ticketId !== target) {
        setMessage(`${g.fullName} is already on another saved ticket. Your current checkout is kept. Review their receipt under Manage saved attendance and receipts.`);
        return;
      }
      const arrival = latest.people.find(
        (p) =>
          p.source === g.source &&
          (p.participant_id ?? p.legacy_participant_id) === idFor(g),
      );
      const added = latest.tickets
        .find((t) => t.id === (saved.ticketId ?? target))
        ?.items.find((i) => i.attendance_id === arrival?.id);
      const mode = "adultMode" in g ? g.adultMode : null;
      if (added && g.role !== "child" && mode && !added.classification) {
        await command("edit", {
          ticketId: saved.ticketId ?? target,
          itemId: added.id,
          classification:
            mode === "playing" ? "playing_adult" : "watching_adult",
          amountCents: mode === "playing" ? 1000 : 0,
          reason: "",
        });
        latest = await refresh();
      }
      setMessage(
        `${g.fullName} marked Here and added to the current checkout.`,
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to add this guest. Refresh to check their saved arrival.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function complete() {
    if (lock.current || !ticket || !base?.ready || readOnly || recovering || isDeskTicketClosed(ticket)) return;
    if (due > 0 && !method) {
      setError("Choose cash or card for the balance.");
      return;
    }
    const key = checkoutRequestKey(ticket.id, method, passes);
    if (attempt.current && attempt.current.key !== key) {
      setError(
        "Refresh and check the previous checkout before changing a retry.",
      );
      return;
    }
    attempt.current ??= { key, id: crypto.randomUUID(), ticketId: ticket.id, method, passes: [...passes] };
    setPendingCheckout(true);
    try { window.localStorage.setItem(storageKey + ":checkout", JSON.stringify(attempt.current)); }
    catch { /* The server also prevents recording checkout twice for a ticket. */ }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await command("complete_checkout", {
        ticketId: ticket.id,
        idempotencyKey: attempt.current.id,
        method,
        freePassItemIds: passes,
      });
      resetCheckout();
      setMessage("Checkout complete. Ready for the next customer.");
      await refresh().catch(() =>
        setError("Checkout is saved. Refresh to reload the latest attendance."),
      );
      window.scrollTo({ top: 0 });
      window.setTimeout(() => input.current?.focus(), 50);
    } catch (e) {
      if (e instanceof DeskRequestError && [400, 401, 403, 429].includes(e.status)) {
        // These responses reject the command without committing checkout.
        attempt.current = null;
        setPendingCheckout(false);
        try { window.localStorage.removeItem(storageKey + ":checkout"); } catch { /* No storage. */ }
      }
      setError(
        e instanceof Error
          ? e.message
          : "Unable to complete checkout. Your saved ticket is still here.",
      );
      await refresh().catch(() => { /* Keep the original error and retry id on uncertain writes. */ });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function nextCustomer() {
    if (lock.current || readOnly) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await refresh();
      if (attempt.current) {
        setError("The last checkout is still unconfirmed. Retry Complete checkout with the same payment choice before starting the next customer.");
        return;
      }
      resetCheckout();
      setManage(false);
      setMessage("Ready for the next customer. Previous attendance and tickets remain saved.");
      window.scrollTo({ top: 0 });
      window.setTimeout(() => input.current?.focus(), 50);
    } catch (e) { setError(e instanceof Error ? e.message : "Refresh before starting the next customer."); }
    finally { lock.current = false; setBusy(false); }
  }
  const lines = ticket?.items ?? [];
  const completed = (ticket as typeof ticket & { completed_at?: string })
    ?.completed_at;
  if (readOnly)
    return (
      <WaiverDeskManager
        day={day}
        initial={initial}
        isOwner={isOwner}
        readOnly
      />
    );
  return (
    <div className="mt-6 space-y-5 text-slate-950">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-cyan-950 p-4 text-white">
        <p className="font-black">
          {state.people.filter((p) => !p.checked_out_at).length} guests here
          today
        </p>
        <div className="flex flex-wrap gap-2"><button type="button" className={secondary} disabled={busy || recovering} onClick={() => void nextCustomer()}>Next customer</button><button
          type="button"
          className={secondary}
          disabled={busy}
          onClick={() => void refresh().then(() => setError("")).catch((e) => setError(e.message))}
        >
          Refresh
        </button></div>
      </div>
      {recovering && <p role="status">Checking saved attendance and checkout…</p>}
      {pendingCheckout && !recovering && <p role="status" className="rounded-xl bg-amber-50 p-4 font-bold text-amber-900">Checking the last checkout. Use Refresh to look for its receipt, or retry Complete checkout with the same choices.</p>}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-900"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-4 font-bold text-emerald-900"
        >
          {message}
        </p>
      )}
      <div
        className={`grid items-start gap-5 ${lines.length ? "lg:grid-cols-[minmax(0,1fr)_380px]" : ""}`}
      >
        <div className="min-w-0 space-y-5">
          {stage === "search" ? (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <label htmlFor="desk-name-search" className="font-black">
                  Search a customer’s first, last, or full name
                </label>
                <input
                  ref={input}
                  id="desk-name-search"
                  type="search"
                  value={query}
                  autoComplete="off"
                  className="mt-3 min-h-12 w-full rounded-xl border-2 border-slate-300 px-4 text-base"
                  onChange={(e) => {
                    groupController.current?.abort();
                    setQuery(e.target.value);
                    setResults([]);
                    setGroup(null);
                    setGroupLoading(false);
                    setLoading(!!e.target.value.trim());
                    setError("");
                  }}
                />
                <p className="mt-2 text-sm text-slate-600">
                  Open a name to view everyone on their original waiver.
                </p>
              </section>
              {groupLoading && <p role="status">Opening waiver group…</p>}
              {group && (
                <section className="rounded-2xl border-2 border-cyan-200 bg-cyan-50 p-4">
                  <h2 className="text-xl font-black">Original waiver group</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Click each person who is here. Keep searching to add
                    customers from other groups.
                  </p>
                  <div className="mt-4 space-y-3">
                    {group.map((g) => {
                      const presence = presenceFor(g),
                        savedTicket = state.tickets.find(t => t.items.some(i => i.attendance_id === presence?.id)),
                        onTicket =
                          presence &&
                          lines.some((i) => i.attendance_id === presence.id);
                      return (
                        <div
                          key={g.selectionKey}
                          className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3"
                        >
                          <button
                            type="button"
                            className="min-h-14 flex-1 text-left"
                            disabled={
                              busy ||
                              recovering || pendingCheckout ||
                              !!savedTicket ||
                              !!onTicket ||
                              g.expired ||
                              !g.checkInEligible
                            }
                            onClick={() => void add(g)}
                          >
                            <span className="block text-lg font-black">
                              {g.fullName}
                            </span>
                            <span className="block text-sm text-slate-600">
                              {g.role === "child" ? "Child" : "Adult"} · {g.birthYear ? `Born ${g.birthYear}` : "Birthdate missing"}
                            </span>
                            <span className="mt-1 block text-sm font-bold text-emerald-800">
                              {onTicket
                                ? "Here — in current checkout"
                                : savedTicket ? "Already checked in — view saved ticket"
                                : g.expired || !g.checkInEligible
                                  ? "New waiver required"
                                  : "Click name to mark Here"}
                            </span>
                            {(g.expired || !g.checkInEligible) && <span className="mt-1 block text-sm font-semibold text-red-800">{g.expiresOnYmd && g.expiresOnYmd <= day ? `Waiver expired ${g.expiresOnYmd}. Complete a new waiver.` : !g.dobYmd ? "Birthdate missing. Complete a new waiver with a date of birth." : "A current waiver is required before admission."}</span>}
                          </button>
                          <button
                            type="button"
                            className="text-sm font-bold underline"
                            onClick={() =>
                              setNameTarget(g as EditableWaiverName)
                            }
                          >
                            Edit name
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {group.some((g) => g.expired || !g.checkInEligible) && (
                    <Link
                      href="/waiver"
                      target="_blank"
                      className={`${primary} mt-4 inline-flex items-center`}
                    >
                      Open waiver form
                    </Link>
                  )}
                </section>
              )}
              <section>
                <h2 className="mb-3 text-xl font-black">Search results</h2>
                {loading ? (
                  <p role="status">Loading…</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {results.map((r) => (
                      <button
                        type="button"
                        key={r.selectionKey}
                        className="min-h-24 rounded-xl border-2 border-slate-200 bg-white p-4 text-left"
                        onClick={() => void openGroup(r)}
                      >
                        <span className="block text-lg font-black">
                          {r.fullName}
                        </span>
                        <span className="mt-1 block text-sm text-slate-600">
                          {r.birthYear ? `Born ${r.birthYear}` : "Birthdate missing"} · View saved group
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {query && !loading && !error && !results.length && (
                  <p>
                    No matching waiver. Check the spelling or sign a new waiver.
                  </p>
                )}
              </section>
            </>
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h1 className="text-3xl font-black">Checkout</h1>
              <p className="mt-2 text-slate-600">
                Assign passes to their recipients, then record cash or card
                collected for the remaining balance.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {(["card", "cash"] as const).map((m) => (
                  <button
                    type="button"
                    key={m}
                    disabled={busy || pendingCheckout || due === 0}
                    aria-pressed={method === m}
                    className={`${secondary} ${method === m ? "border-emerald-500 bg-emerald-50" : ""}`}
                    onClick={() => setMethod(m)}
                  >
                    {m === "card" ? "Card" : "Cash"}
                  </button>
                ))}
                <button
                  type="button"
                  aria-expanded={showPasses}
                  disabled={busy || pendingCheckout}
                  className={secondary}
                  onClick={() => setShowPasses((v) => !v)}
                >
                  Free pass
                </button>
              </div>
              {showPasses && (
                <fieldset className="mt-5 space-y-3 rounded-xl border-2 border-emerald-200 p-4">
                  <legend className="px-2 font-black">
                    Assign free passes
                  </legend>
                  {lines
                    .filter(
                      (i) =>
                        (i.amount_cents ?? 0) > i.credited_cents &&
                        i.classification !== "watching_adult",
                    )
                    .map((item) => (
                      <label
                        key={item.id}
                        className="flex min-h-12 items-center gap-3 font-bold"
                      >
                        <input
                          type="checkbox"
                          className="h-5 w-5 accent-emerald-700"
                          disabled={busy || pendingCheckout}
                          checked={passes.includes(item.id)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setPasses((p) =>
                              checked
                                ? [...p, item.id]
                                : p.filter((id) => id !== item.id),
                            );
                          }}
                        />
                        {personFor(item)
                          ? displayName(personFor(item)!)
                          : "Guest"}{" "}
                        — deduct {formatCents(passValue(item))}
                      </label>
                    ))}
                  <p className="text-sm text-slate-600">
                    Each pass covers its recipient’s admission. Watching adults
                    are already free.
                  </p>
                </fieldset>
              )}
              <dl className="mt-6 space-y-3 border-t border-slate-200 pt-4">
                <div className="flex justify-between">
                  <dt>Admission subtotal</dt>
                  <dd>{formatCents(base?.total ?? 0)}</dd>
                </div>
                {(base?.credit ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <dt>Previously covered admission</dt>
                    <dd>−{formatCents(base!.credit)}</dd>
                  </div>
                )}
                <div className="flex justify-between text-emerald-800">
                  <dt>Free passes</dt>
                  <dd>−{formatCents(deduction)}</dd>
                </div>
                <div className="flex justify-between text-2xl font-black">
                  <dt>Amount due</dt>
                  <dd>{formatCents(due)}</dd>
                </div>
              </dl>
              {due === 0 && (
                <p className="mt-3 font-bold text-emerald-800">
                  No payment is due.
                </p>
              )}
              <div className="mt-6 grid gap-3">
                <button
                  type="button"
                  disabled={busy || pendingCheckout}
                  className={secondary}
                  onClick={() => setStage("search")}
                >
                  Back to check-in / add more names
                </button>
                <button
                  type="button"
                  className={primary}
                  disabled={
                    busy || recovering || !base?.ready || !!completed || (due > 0 && !method)
                  }
                  onClick={() => void complete()}
                >
                  {busy ? "Completing checkout…" : "Complete checkout"}
                </button>
              </div>
            </section>
          )}
        </div>
        {ticket && lines.length > 0 && (
          <aside
            aria-label="Current checkout"
            className="self-start rounded-2xl border-2 border-emerald-300 bg-white p-4 shadow-lg lg:sticky lg:top-6"
          >
            <h2 className="text-xl font-black">
              Current checkout ({lines.length})
            </h2>
            <div className="mt-4 space-y-3">
              {lines.map((item) => {
                const person = personFor(item);
                if (!person) return null;
                const adult = person.role !== "child";
                return (
                  <div key={item.id} className="rounded-xl bg-slate-50 p-3">
                    <div className="flex justify-between gap-2">
                      <p className="font-black">{displayName(person)}</p>
                      <button
                        type="button"
                        disabled={busy || recovering || pendingCheckout || !!completed || (base?.paid ?? 0) > 0}
                        aria-label={`Remove ${displayName(person)}`}
                        className="font-bold text-red-700"
                        onClick={() =>
                          void mutate("remove", {
                            ticketId: ticket.id,
                            itemId: item.id,
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.amount_cents === null
                        ? "Choose watching or playing"
                        : formatCents(item.amount_cents)}
                      {item.reason ? ` · ${item.reason}` : ""}
                    </p>
                    {adult && (
                      <fieldset className="mt-2">
                        <legend className="sr-only">
                          Attendance for {displayName(person)}
                        </legend>
                        <div className="flex flex-wrap gap-3">
                          {(["watching", "playing"] as const).map((mode) => (
                            <label
                              key={mode}
                              className="flex min-h-11 items-center gap-2 text-sm font-bold"
                            >
                              <input
                                type="checkbox"
                                className="h-5 w-5 accent-emerald-700"
                                checked={
                                  item.classification ===
                                  (mode === "playing"
                                    ? "playing_adult"
                                    : "watching_adult")
                                }
                                disabled={
                                  busy || recovering || pendingCheckout || !!completed || (base?.paid ?? 0) > 0
                                }
                                onChange={() =>
                                  void mutate("edit", {
                                    ticketId: ticket.id,
                                    itemId: item.id,
                                    classification:
                                      mode === "playing"
                                        ? "playing_adult"
                                        : "watching_adult",
                                    amountCents: mode === "playing" ? 1000 : 0,
                                    reason: "",
                                  })
                                }
                              />
                              {mode === "watching"
                                ? "Watching · Free"
                                : "Playing · $10"}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    )}
                    {passes.includes(item.id) && (
                      <p className="font-bold text-emerald-800">
                        Free pass assigned
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-4 flex justify-between text-xl font-black">
              <span>{stage === "checkout" ? "Amount due" : "Total"}</span>
              <span>{formatCents(due)}</span>
            </p>
            {stage === "search" && (
              <button
                type="button"
                className={`${primary} mt-4 w-full`}
                disabled={busy || recovering || !base?.ready || !!completed}
                onClick={() => {
                  setStage("checkout");
                  setError("");
                  window.scrollTo({ top: 0 });
                }}
              >
                Checkout
              </button>
            )}
            {!base?.ready && (
              <p className="mt-2 text-sm text-amber-800">
                Choose watching or playing for each adult.
              </p>
            )}
          </aside>
        )}
      </div>
      <button
        type="button"
        className={secondary}
        aria-expanded={manage}
        onClick={() => setManage((v) => !v)}
      >
        Manage saved attendance and receipts
      </button>
      {manage && (
        <WaiverDeskManager
          day={day}
          initial={state}
          isOwner={isOwner}
          readOnly={readOnly}
        />
      )}
      {nameTarget && (
        <EditWaiverNameDialog
          target={nameTarget}
          onClose={() => setNameTarget(null)}
          onSaved={() => {
            setNameTarget(null);
            setQuery("");
            setResults([]);
            setGroup(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
function displayName(person: DeskPerson) {
  return person.first_name + " " + person.last_name;
}
