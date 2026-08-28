"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type MutableRefObject } from "react";

import {
  DEFAULT_SCHEDULE_FILTERS,
  filterScheduleEvents,
  groupEventsByDate,
  selectedFilterLabels,
  toYmd,
  type CalendarDay,
  type CalendarEvent,
  type ScheduleEventType,
  type ScheduleFilters,
  type ScheduleView,
} from "@/lib/admin/schedule";
import {
  scheduleTypeLabel,
} from "@/lib/admin/schedule-display";
import { formatProductLabel } from "@/lib/admin/schedule-products";
import {
  printOrientationForView,
  resolvePrintDays,
} from "@/lib/admin/schedule-print";

import { ScheduleBookingDetailsModal } from "./ScheduleBookingDetailsModal";
import { ScheduleDayBlock } from "./ScheduleDayBlock";

const FILTER_STORAGE_KEY = "jumpingjax:schedule-filters:v2";
const SHOW_CANCELLED_STORAGE_KEY = "jumpingjax:schedule-show-cancelled:v1";

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
  return scheduleTypeLabel(type).toUpperCase();
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

function restoreShowCancelled(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(SHOW_CANCELLED_STORAGE_KEY) === "true";
}

function eventTimeSummary(event: CalendarEvent): string {
  return event.displayTime && event.displayTime !== "Time not set"
    ? event.displayTime
    : "Time not set";
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
              <section key={day.ymd} className="schedule-print-day">
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
                        className="schedule-print-event break-inside-avoid border border-slate-900 p-2 text-sm"
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
    <div className="schedule-email-panel mt-4 rounded-2xl border border-slate-200 bg-white p-4 print:hidden">
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

function calendarGridClass(view: ScheduleView): string {
  if (view === "day") return "mt-6 grid gap-4";
  if (view === "week") {
    return "mt-6 grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-7";
  }
  return "mt-6 grid grid-cols-2 items-stretch gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7";
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
  focusMonth,
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
  focusMonth?: number;
}) {
  const [filters, setFilters] = useState<ScheduleFilters>(() =>
    restoreFilters(),
  );
  const [showCancelled, setShowCancelled] = useState<boolean>(() =>
    restoreShowCancelled(),
  );
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [todayYmd] = useState(() => toYmd(new Date()));
  const emailSendingLockRef = useRef(false);
  const printOrientation = printOrientationForView(view);

  useEffect(() => {
    window.sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    window.sessionStorage.setItem(
      SHOW_CANCELLED_STORAGE_KEY,
      String(showCancelled),
    );
  }, [showCancelled]);

  const visibleEvents = useMemo(
    () => filterScheduleEvents(events, filters, showCancelled),
    [events, filters, showCancelled],
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

  const closeDetails = useCallback(() => {
    setSelectedEvent(null);
  }, []);

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

  function isOutsideMonth(day: CalendarDay): boolean {
    if (view !== "month" || focusMonth === undefined) return false;
    const month = Number(day.ymd.slice(5, 7));
    return month !== focusMonth + 1;
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
            Cancelled view
          </legend>
          <label className="inline-flex min-h-11 items-center gap-2 text-sm font-black text-slate-800">
            <input
              type="checkbox"
              checked={showCancelled}
              onChange={(event) => setShowCancelled(event.target.checked)}
              className="h-4 w-4 accent-orange-600"
            />
            Cancelled bookings
          </label>
          <p className="mt-2 text-xs font-semibold text-slate-600">
            Cancelled bookings are excluded from the active Schedule. Turn this on
            to review only cancelled bookings that match the selected types.
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
          <div className={calendarGridClass(view)}>
            {days.map((day) => {
              const dayEvents = eventsByDate[day.ymd] ?? [];
              return (
                <ScheduleDayBlock
                  key={day.ymd}
                  day={day}
                  events={dayEvents}
                  density={view}
                  isOutsideMonth={isOutsideMonth(day)}
                  isToday={day.ymd === todayYmd}
                  onSelectBooking={setSelectedEvent}
                />
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
        <div className="schedule-print-preview mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm">
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

      <div className="schedule-print-output hidden print:block">
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

      <ScheduleBookingDetailsModal
        event={selectedEvent}
        onClose={closeDetails}
      />
    </>
  );
}
