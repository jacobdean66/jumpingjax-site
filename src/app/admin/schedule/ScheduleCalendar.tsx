"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition, type MutableRefObject } from "react";

import {
  DEFAULT_SCHEDULE_FILTERS,
  filterScheduleEvents,
  groupEventsByDate,
  selectedFilterLabels,
  type CalendarDay,
  type CalendarEvent,
  type ScheduleEventType,
  type ScheduleFilters,
  type ScheduleView,
} from "@/lib/admin/schedule";
import { formatProductLabel } from "@/lib/admin/schedule-products";
import {
  printOrientationForView,
  resolvePrintDays,
} from "@/lib/admin/schedule-print";
import { StatusBadge } from "../_components";

const FILTER_STORAGE_KEY = "jumpingjax:schedule-filters:v2";

const FILTER_OPTIONS: {
  type: ScheduleEventType;
  label: string;
}[] = [
  { type: "rental", label: "Rentals" },
  { type: "foam-party", label: "Foam Parties" },
  { type: "public-party", label: "Public facility parties" },
  { type: "private-party", label: "Private facility parties" },
];

function typeLabel(type: ScheduleEventType): string {
  if (type === "rental") return "RENTAL";
  if (type === "foam-party") return "FOAM PARTY";
  if (type === "public-party") return "PUBLIC PARTY";
  return "PRIVATE PARTY";
}

function typeTone(type: ScheduleEventType): string {
  if (type === "rental") return "border-sky-200 bg-sky-50 text-sky-950";
  if (type === "foam-party") return "border-cyan-200 bg-cyan-50 text-cyan-950";
  if (type === "public-party") {
    return "border-pink-200 bg-pink-50 text-pink-950";
  }
  return "border-violet-200 bg-violet-50 text-violet-950";
}

function isScheduleFilters(value: unknown): value is ScheduleFilters {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ScheduleFilters>;
  return FILTER_OPTIONS.every((option) => typeof candidate[option.type] === "boolean");
}

function restoreFilters(): ScheduleFilters {
  if (typeof window === "undefined") return DEFAULT_SCHEDULE_FILTERS;
  try {
    const parsed = JSON.parse(
      window.sessionStorage.getItem(FILTER_STORAGE_KEY) ?? "",
    );
    return isScheduleFilters(parsed) ? parsed : DEFAULT_SCHEDULE_FILTERS;
  } catch {
    return DEFAULT_SCHEDULE_FILTERS;
  }
}

function eventTimeSummary(event: CalendarEvent): string {
  return event.displayTime && event.displayTime !== "Time not set"
    ? event.displayTime
    : "Time not set";
}

function ProductList({
  products,
  compact = false,
}: {
  products: CalendarEvent["products"];
  compact?: boolean;
}) {
  if (products.length === 0) return null;
  if (compact && products.length > 2) {
    return (
      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-black">
          {products.length} products
        </summary>
        <ul className="mt-2 flex flex-wrap gap-1">
          {products.map((product) => (
            <li
              key={`${product.rentalItem}-${product.name}`}
              className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-bold"
            >
              {formatProductLabel(product)}
            </li>
          ))}
        </ul>
      </details>
    );
  }

  return (
    <ul className="mt-2 flex flex-wrap gap-1">
      {products.map((product) => (
        <li
          key={`${product.rentalItem}-${product.name}`}
          className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-bold print:border-slate-900"
        >
          {formatProductLabel(product)}
        </li>
      ))}
    </ul>
  );
}

function EventCard({ event }: { event: CalendarEvent }) {
  return (
    <article
      className={`rounded-xl border p-3 shadow-sm print:break-inside-avoid print:border-slate-900 print:bg-white print:text-black print:shadow-none ${typeTone(event.type)}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-950 print:border print:border-slate-900 print:bg-white">
          {typeLabel(event.type)}
        </span>
        <StatusBadge status={event.status} />
      </div>

      <h3 className="mt-3 break-words text-base font-black leading-snug">
        {event.customer}
      </h3>
      <ProductList products={event.products} compact />
      {event.products.length === 0 ? (
        <p className="mt-1 break-words text-sm font-bold">{event.title}</p>
      ) : null}
      {event.phone ? (
        <p className="mt-2 break-words text-xs font-black text-slate-700 print:text-black">
          Phone: {event.phone}
        </p>
      ) : null}
      <dl className="mt-3 grid gap-2 text-xs font-semibold leading-relaxed text-slate-700 print:text-black">
        <div>
          <dt className="font-black uppercase tracking-wide text-slate-500 print:text-black">
            Time
          </dt>
          <dd className="break-words">{eventTimeSummary(event)}</dd>
        </div>
        {event.room ? (
          <div>
            <dt className="font-black uppercase tracking-wide text-slate-500 print:text-black">
              Room
            </dt>
            <dd className="break-words">{event.room}</dd>
          </div>
        ) : null}
        {event.location ? (
          <div>
            <dt className="font-black uppercase tracking-wide text-slate-500 print:text-black">
              Location
            </dt>
            <dd className="break-words">{event.location}</dd>
          </div>
        ) : null}
      </dl>
      <details className="mt-3 print:hidden">
        <summary className="cursor-pointer text-xs font-black uppercase tracking-wide">
          Details
        </summary>
        <div className="mt-3 grid gap-2 border-t border-current/10 pt-3 text-xs">
          {event.details.map((detail) => (
            <div key={detail.label}>
              <p className="font-black uppercase tracking-wide opacity-70">
                {detail.label}
              </p>
              <p className="break-words font-semibold">
                {detail.value || "Not set"}
              </p>
            </div>
          ))}
        </div>
      </details>
      <Link
        href={event.detailHref}
        className="mt-3 inline-flex rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 print:hidden"
      >
        Open full details
      </Link>
    </article>
  );
}

function PrintAgenda({
  days,
  eventsByDate,
  heading,
  selectedLabels,
  visibleCount,
  noTypesSelected,
  className = "hidden print:block",
}: {
  days: CalendarDay[];
  eventsByDate: Record<string, CalendarEvent[]>;
  heading: string;
  selectedLabels: string[];
  visibleCount: number;
  noTypesSelected: boolean;
  className?: string;
}) {
  return (
    <section className={className}>
      <h1 className="text-2xl font-black">Jumping Jax Schedule</h1>
      <div className="mt-2 grid gap-1 text-sm">
        <p>Date range: {heading}</p>
        <p>
          Booking types:{" "}
          {noTypesSelected ? "No booking types selected" : selectedLabels.join(", ")}
        </p>
        <p>Total visible bookings: {visibleCount}</p>
      </div>
      <div className="mt-5 grid gap-4">
        {noTypesSelected ? (
          <p className="border border-slate-900 p-3 font-bold">
            No booking types selected.
          </p>
        ) : (
          days.map((day) => {
            const events = eventsByDate[day.ymd] ?? [];
            return (
              <section key={day.ymd} className="break-inside-avoid">
                <h2 className="border-b border-slate-900 pb-1 text-base font-black">
                  {day.dayName}, {day.label}
                </h2>
                {events.length === 0 ? (
                  <p className="mt-2 text-sm font-semibold">No bookings</p>
                ) : (
                  <ul className="mt-2 grid gap-2">
                    {events.map((event) => (
                      <li
                        key={event.id}
                        className="break-inside-avoid border border-slate-900 p-2 text-sm"
                      >
                        <span className="font-black">{typeLabel(event.type)}</span>
                        {" - "}
                        <span>{event.customer}</span>
                        {event.phone ? (
                          <>
                            {" - "}
                            <span>{event.phone}</span>
                          </>
                        ) : null}
                        {" - "}
                        <span>
                          {event.products.length > 0
                            ? event.products.map(formatProductLabel).join(", ")
                            : event.title}
                        </span>
                        {" - "}
                        <span>{eventTimeSummary(event)}</span>
                        {event.room ? (
                          <>
                            {" - "}
                            <span>{event.room}</span>
                          </>
                        ) : null}
                        {event.location ? (
                          <>
                            {" - "}
                            <span>{event.location}</span>
                          </>
                        ) : null}
                        {" - "}
                        <span>{event.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })
        )}
      </div>
    </section>
  );
}

function ScheduleEmailPanel({
  events,
  dates,
  heading,
  sendingLockRef,
}: {
  events: CalendarEvent[];
  dates: string[];
  heading: string;
  sendingLockRef: MutableRefObject<boolean>;
}) {
  const [recipients, setRecipients] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function sendEmail() {
    if (sendingLockRef.current || pending) return;
    sendingLockRef.current = true;
    setStatus("sending");
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/schedule/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipients,
            dates,
            heading,
            events: events.map((event) => ({
              id: event.id,
              type: event.type,
              date: event.date,
              customer: event.customer,
              phone: event.phone,
              title: event.title,
              products: event.products.map(formatProductLabel),
              displayTime: event.displayTime,
              location: event.location,
              room: event.room,
              status: event.status,
            })),
          }),
        });
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          ok?: boolean;
        } | null;
        if (!response.ok) {
          setStatus("error");
          setMessage(payload?.error ?? "Unable to send schedule email.");
          return;
        }
        setStatus("success");
        setMessage("Schedule email sent.");
      } catch {
        setStatus("error");
        setMessage("Unable to send schedule email.");
      } finally {
        sendingLockRef.current = false;
      }
    });
  }

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 print:hidden">
      <p className="text-sm font-black text-slate-800">Email this schedule</p>
      <label className="mt-2 block text-xs font-bold text-slate-600">
        Recipients (comma-separated)
        <input
          type="email"
          multiple
          value={recipients}
          onChange={(event) => setRecipients(event.target.value)}
          placeholder="name@example.com"
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </label>
      <button
        type="button"
        onClick={sendEmail}
        disabled={pending || status === "sending" || !recipients.trim()}
        className="mt-3 rounded-full bg-sky-500 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending || status === "sending" ? "Sending…" : "Email schedule"}
      </button>
      {message ? (
        <p
          className={`mt-2 text-sm font-semibold ${
            status === "error" ? "text-rose-700" : "text-emerald-700"
          }`}
          role="status"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function ScheduleCalendar({
  days,
  events,
  error,
  view,
  heading,
  rangeLabel,
  previousHref,
  nextHref,
  dayHref,
  weekHref,
  monthHref,
}: {
  days: CalendarDay[];
  events: CalendarEvent[];
  error: string | null;
  view: ScheduleView;
  heading: string;
  rangeLabel: string;
  previousHref: string;
  nextHref: string;
  dayHref: string;
  weekHref: string;
  monthHref: string;
}) {
  const [filters, setFilters] = useState<ScheduleFilters>(() =>
    restoreFilters(),
  );
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const emailSendingLockRef = useRef(false);
  const printOrientation = printOrientationForView(view);

  useEffect(() => {
    window.sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  const visibleEvents = useMemo(
    () => filterScheduleEvents(events, filters),
    [events, filters],
  );
  const eventsByDate = useMemo(
    () => groupEventsByDate(visibleEvents),
    [visibleEvents],
  );
  const selectedLabels = selectedFilterLabels(filters);
  const noTypesSelected = selectedLabels.length === 0;

  const printDays = useMemo(
    () =>
      resolvePrintDays({
        days,
        selectedDates,
        eventsByDate,
        // Keep intentionally selected dates even when empty so print/email do
        // not fall back to the full view.
        includeEmpty: selectedDates.length > 0,
      }),
    [days, selectedDates, eventsByDate],
  );

  const agendaDays = useMemo(() => {
    if (selectedDates.length > 0) return printDays;
    return days;
  }, [selectedDates.length, printDays, days]);

  const printEvents = useMemo(() => {
    if (selectedDates.length === 0) return visibleEvents;
    const selected = new Set(selectedDates);
    return visibleEvents.filter((event) => selected.has(event.date));
  }, [visibleEvents, selectedDates]);

  const printHeading =
    selectedDates.length > 0
      ? [...selectedDates].sort().join(", ")
      : heading;

  function updateFilter(type: ScheduleEventType, checked: boolean) {
    setFilters((current) => ({ ...current, [type]: checked }));
  }

  function toggleDate(ymd: string) {
    setSelectedDates((current) =>
      current.includes(ymd)
        ? current.filter((value) => value !== ymd)
        : [...current, ymd].sort(),
    );
  }

  function selectAllVisibleDates() {
    setSelectedDates(days.map((day) => day.ymd));
  }

  function clearDateSelection() {
    setSelectedDates([]);
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: ${printOrientation};
            margin: 0.35in;
          }
          html,
          body {
            background: #fff !important;
          }
        }
      `}</style>

      <div className="print:hidden">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              {view.toUpperCase()} VIEW - {visibleEvents.length} booking
              {visibleEvents.length === 1 ? "" : "s"}
            </p>
            <h2 className="mt-1 text-3xl font-black">{heading}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Loaded range: {rangeLabel}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-black"
              href={previousHref}
            >
              Previous
            </Link>
            <Link
              className={
                view === "day"
                  ? "rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white"
                  : "rounded-full bg-slate-100 px-4 py-2 text-sm font-black"
              }
              href={dayHref}
            >
              Day
            </Link>
            <Link
              className={
                view === "week"
                  ? "rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white"
                  : "rounded-full bg-slate-100 px-4 py-2 text-sm font-black"
              }
              href={weekHref}
            >
              Week
            </Link>
            <Link
              className={
                view === "month"
                  ? "rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white"
                  : "rounded-full bg-slate-100 px-4 py-2 text-sm font-black"
              }
              href={monthHref}
            >
              Month
            </Link>
            <Link
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-black"
              href={nextHref}
            >
              Next
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-amber-950"
            >
              Print schedule
            </button>
          </div>
        </div>

        <fieldset
          className={`mt-5 rounded-2xl border p-4 ${
            filters["foam-party"] &&
            !filters.rental &&
            !filters["public-party"] &&
            !filters["private-party"]
              ? "border-cyan-400 bg-cyan-50"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <legend className="px-1 text-sm font-black text-slate-700">
            Booking types
          </legend>
          <div className="flex flex-wrap items-center gap-3">
            {FILTER_OPTIONS.map((option) => (
              <label
                key={option.type}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-black ${
                  filters[option.type]
                    ? option.type === "foam-party"
                      ? "border-cyan-400 bg-cyan-100 text-cyan-950"
                      : "border-slate-900 bg-white text-slate-950"
                    : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                <input
                  type="checkbox"
                  checked={filters[option.type]}
                  onChange={(event) =>
                    updateFilter(option.type, event.target.checked)
                  }
                  className="h-4 w-4 accent-sky-600"
                />
                {option.label}
              </label>
            ))}
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_SCHEDULE_FILTERS)}
              className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() =>
                setFilters({
                  rental: false,
                  "foam-party": false,
                  "public-party": false,
                  "private-party": false,
                })
              }
              className="rounded-full border border-slate-300 px-3 py-2 text-xs font-black"
            >
              Clear all
            </button>
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-600">
            Foam Parties includes bookings with any foam-party product, including
            mixed carts that also have other rentals.
          </p>
        </fieldset>

        <fieldset className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <legend className="px-1 text-sm font-black text-slate-700">
            Print / email specific dates
          </legend>
          <p className="text-xs font-semibold text-slate-600">
            Select any combination of visible dates (they do not need to be
            consecutive). Leave empty to use the full current view.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {days.map((day) => {
              const checked = selectedDates.includes(day.ymd);
              return (
                <label
                  key={day.ymd}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black ${
                    checked
                      ? "border-amber-400 bg-amber-100 text-amber-950"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleDate(day.ymd)}
                    className="h-4 w-4 accent-amber-600"
                  />
                  {day.dayName} {day.label}
                </label>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={selectAllVisibleDates}
              className="rounded-full bg-slate-950 px-3 py-2 text-xs font-black text-white"
            >
              Select all visible dates
            </button>
            <button
              type="button"
              onClick={clearDateSelection}
              className="rounded-full border border-slate-300 px-3 py-2 text-xs font-black"
            >
              Clear selection
            </button>
            {selectedDates.length > 0 ? (
              <p className="self-center text-xs font-bold text-amber-800">
                Selected: {[...selectedDates].sort().join(", ")}
              </p>
            ) : (
              <p className="self-center text-xs font-semibold text-slate-500">
                No specific dates selected — print uses full view.
              </p>
            )}
          </div>
          <ScheduleEmailPanel
            events={printEvents}
            dates={
              selectedDates.length > 0
                ? [...selectedDates].sort()
                : days.map((day) => day.ymd)
            }
            heading={printHeading}
            sendingLockRef={emailSendingLockRef}
          />
        </fieldset>

        {error ? (
          <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-black text-rose-900">
              Schedule data could not load: {error}
            </p>
            <p className="mt-1 text-sm font-semibold text-rose-800">
              This should clear after the Supabase project is restored.
            </p>
          </div>
        ) : null}

        {noTypesSelected ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-lg font-black">No booking types selected.</p>
          </div>
        ) : (
          <div
            className={
              view === "day"
                ? "mt-6 grid gap-4"
                : "mt-6 grid items-start gap-3 lg:grid-cols-7"
            }
          >
            {days.map((day) => {
              const dayEvents = eventsByDate[day.ymd] ?? [];
              return (
                <section
                  key={day.ymd}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div>
                    <p className="text-xs font-black text-slate-500">
                      {day.dayName}
                    </p>
                    <h3 className="mt-1 text-lg font-black leading-none">
                      {day.label}
                    </h3>
                    {dayEvents.length > 0 ? (
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {dayEvents.length} booking
                        {dayEvents.length === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-3 grid gap-2">
                    {dayEvents.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-500">
                        No bookings
                      </p>
                    ) : (
                      dayEvents.map((event) => (
                        <EventCard key={event.id} event={event} />
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-slate-800">Printable schedule preview</p>
            <p className="text-xs font-semibold text-slate-600">
              Same content used for print and email
              {selectedDates.length > 0
                ? ` (${[...selectedDates].sort().join(", ")})`
                : " (full current view)"}
              .
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-amber-950"
          >
            Print this view
          </button>
        </div>
        <ScheduleEmailPanel
          events={printEvents}
          dates={
            selectedDates.length > 0
              ? [...selectedDates].sort()
              : days.map((day) => day.ymd)
          }
          heading={printHeading}
          sendingLockRef={emailSendingLockRef}
        />
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm">
          <PrintAgenda
            className="block"
            days={agendaDays}
            eventsByDate={eventsByDate}
            heading={printHeading}
            selectedLabels={selectedLabels}
            visibleCount={printEvents.length}
            noTypesSelected={noTypesSelected}
          />
        </div>
      </section>

      <div className="hidden print:block">
        <PrintAgenda
          className="block"
          days={agendaDays}
          eventsByDate={eventsByDate}
          heading={printHeading}
          selectedLabels={selectedLabels}
          visibleCount={printEvents.length}
          noTypesSelected={noTypesSelected}
        />
      </div>
    </>
  );
}
