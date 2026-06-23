"use client";

import { useState } from "react";

export type CalendarDay = {
  ymd: string;
  dayName: string;
  label: string;
};

export type CalendarEvent = {
  id: string;
  kind: "rental" | "facility";
  date: string;
  time: string | null;
  displayTime: string;
  title: string;
  customer: string;
  phone: string | null;
  email: string | null;
  status: string;
  city: string | null;
  details: { label: string; value: string | null }[];
};

function eventHeadline(event: CalendarEvent) {
  if (event.kind === "rental") {
    return `${event.city ?? "Rental"}: ${event.title}`;
  }
  return `${event.displayTime} - ${event.title}`;
}

export function ScheduleCalendar({
  days,
  eventsByDate,
}: {
  days: CalendarDay[];
  eventsByDate: Record<string, CalendarEvent[]>;
}) {
  const [selected, setSelected] = useState<CalendarEvent | null>(null);

  return (
    <>
      <div className="mt-6 grid gap-3 md:grid-cols-7">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <p
            key={day}
            className="hidden text-center text-xs font-black uppercase tracking-wide text-slate-500 md:block"
          >
            {day}
          </p>
        ))}
        {days.map((day) => {
          const events = eventsByDate[day.ymd] ?? [];
          return (
            <div
              key={day.ymd}
              className="flex aspect-square min-h-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              <div className="shrink-0">
                <p className="text-xs font-black text-slate-500">
                  {day.dayName}
                </p>
                <h3 className="mt-1 text-lg font-black leading-none">
                  {day.label}
                </h3>
              </div>
              <div className="mt-3 grid min-h-0 flex-1 gap-1.5 overflow-y-auto pr-1">
                {events.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 bg-white px-2 py-2 text-[10px] font-bold text-slate-500">
                    No bookings
                  </p>
                ) : (
                  events.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setSelected(event)}
                      className="rounded-lg bg-white px-2 py-2 text-left text-[10px] font-bold leading-tight text-slate-700 shadow-sm ring-1 ring-transparent transition hover:ring-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <p className="font-black text-slate-950">
                        {eventHeadline(event)}
                      </p>
                      <p className="mt-1">
                        {event.kind === "rental"
                          ? `${event.displayTime} - ${event.customer}`
                          : event.customer}
                      </p>
                      <p className="mt-1 truncate uppercase tracking-wide text-slate-500">
                        {event.status}
                        {event.phone ? ` | ${event.phone}` : ""}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-700">
                  {selected.kind === "rental" ? "Rental booking" : "Facility party"}
                </p>
                <h2 className="mt-2 text-3xl font-black leading-tight text-slate-950">
                  {eventHeadline(selected)}
                </h2>
                <p className="mt-2 text-sm font-bold text-slate-600">
                  {selected.date} at {selected.displayTime}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {selected.details.map((detail) => (
                <div
                  key={detail.label}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                    {detail.label}
                  </p>
                  <p className="mt-1 break-words text-sm font-bold text-slate-950">
                    {detail.value || "Not set"}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
