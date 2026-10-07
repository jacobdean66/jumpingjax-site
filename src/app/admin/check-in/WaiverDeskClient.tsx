"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { searchWaivers, formatCents } from "@/lib/open-play/check-in-client";
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
    attempt = useRef<{ key: string; id: string } | null>(null),
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
  const refresh = useCallback(async () => {
    const response = await fetch(`/api/admin/open-play/desk?date=${day}`, {
      cache: "no-store",
    });
    const body = await response.json();
    if (!response.ok || !body.ok)
      throw new Error(body.error || "Unable to refresh the desk.");
    setState(body.state as DeskState);
    return body.state as DeskState;
  }, [day]);
  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) void Promise.resolve().then(() => setTicketId(saved));
    const savedAttempt = window.localStorage.getItem(storageKey + ":checkout");
    if (savedAttempt)
      try {
        const restored = JSON.parse(savedAttempt) as {
          key: string;
          id: string;
          ticketId: string;
          method: "cash" | "card" | null;
          passes: string[];
        };
        attempt.current = { key: restored.key, id: restored.id };
        void Promise.resolve().then(() => {
          setTicketId(restored.ticketId);
          setMethod(restored.method);
          setPasses(restored.passes);
          setShowPasses(restored.passes.length > 0);
          setStage("checkout");
        });
      } catch {
        window.localStorage.removeItem(storageKey + ":checkout");
      }
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
      setLoading(true);
      void searchWaivers(query.trim(), controller.signal)
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
  function chooseTicket(id: string | null) {
    setTicketId(id);
    setPasses([]);
    setMethod(null);
    attempt.current = null;
    if (id) window.localStorage.setItem(storageKey, id);
    else window.localStorage.removeItem(storageKey);
  }
  async function command(action: string, payload: Record<string, unknown>) {
    const response = await fetch("/api/admin/open-play/desk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, date: day, action }),
    });
    const body = await response.json();
    if (!response.ok || !body.ok)
      throw new Error(body.error || "Unable to save. Refresh before retrying.");
    return body.result as { ticketId?: string; attendanceId?: string };
  }
  async function mutate(action: string, payload: Record<string, unknown>) {
    if (lock.current || readOnly) return;
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
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/open-play/waivers/groups/${encodeURIComponent(result.submissionId)}`,
        { cache: "no-store", signal: controller.signal },
      );
      const body = await response.json();
      if (!response.ok || !body.ok)
        throw new Error(body.error || "Unable to open the group.");
      if (!controller.signal.aborted) {
        setGroup(body.members);
        setLoading(false);
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(e instanceof Error ? e.message : "Unable to open the group.");
        setLoading(false);
      }
    }
  }
  async function add(g: Guest) {
    if (lock.current || readOnly || !idFor(g)) return;
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
      let target = ticketId;
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
      if (saved.ticketId && saved.ticketId !== target)
        chooseTicket(saved.ticketId);
      let latest = await refresh();
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
    if (lock.current || !ticket || !base?.ready || readOnly) return;
    if (due > 0 && !method) {
      setError("Choose cash or card for the balance.");
      return;
    }
    const key = JSON.stringify([ticket.id, method, [...passes].sort()]);
    if (attempt.current && attempt.current.key !== key) {
      setError(
        "Refresh and check the previous checkout before changing a retry.",
      );
      return;
    }
    attempt.current ??= { key, id: crypto.randomUUID() };
    window.localStorage.setItem(
      storageKey + ":checkout",
      JSON.stringify({
        ...attempt.current,
        ticketId: ticket.id,
        method,
        passes,
      }),
    );
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
      window.localStorage.removeItem(storageKey + ":checkout");
      chooseTicket(null);
      setQuery("");
      setResults([]);
      setGroup(null);
      setStage("search");
      setShowPasses(false);
      setMessage("Checkout complete. Ready for the next customer.");
      await refresh().catch(() =>
        setError("Checkout is saved. Refresh to reload the latest attendance."),
      );
      window.scrollTo({ top: 0 });
      window.setTimeout(() => input.current?.focus(), 50);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to complete checkout. Your saved ticket is still here.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
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
        <button
          type="button"
          className={secondary}
          disabled={busy}
          onClick={() => void refresh().catch((e) => setError(e.message))}
        >
          Refresh
        </button>
      </div>
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
                  Search a customer’s first or last name
                </label>
                <input
                  ref={input}
                  id="desk-name-search"
                  type="search"
                  value={query}
                  autoComplete="off"
                  className="mt-3 min-h-12 w-full rounded-xl border-2 border-slate-300 px-4 text-base"
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setResults([]);
                    setError("");
                  }}
                />
                <p className="mt-2 text-sm text-slate-600">
                  Open a name to view everyone on their original waiver.
                </p>
              </section>
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
                              {g.role === "child" ? "Child" : "Adult"} · Born{" "}
                              {g.birthYear}
                            </span>
                            <span className="mt-1 block text-sm font-bold text-emerald-800">
                              {onTicket
                                ? "Here — in current checkout"
                                : g.expired || !g.checkInEligible
                                  ? "New waiver required"
                                  : "Click name to mark Here"}
                            </span>
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
                          Born {r.birthYear} · View saved group
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {query && !loading && !results.length && (
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
                    disabled={busy || due === 0}
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
                  disabled={busy}
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
                          disabled={busy}
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
                  disabled={busy}
                  className={secondary}
                  onClick={() => setStage("search")}
                >
                  Back to check-in / add more names
                </button>
                <button
                  type="button"
                  className={primary}
                  disabled={
                    busy || !base?.ready || !!completed || (due > 0 && !method)
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
                        disabled={busy || !!completed || (base?.paid ?? 0) > 0}
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
                                  busy || !!completed || (base?.paid ?? 0) > 0
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
                disabled={busy || !base?.ready || !!completed}
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
