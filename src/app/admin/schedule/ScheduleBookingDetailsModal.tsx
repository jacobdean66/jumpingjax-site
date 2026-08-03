"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";

import {
  isCancelledStatus,
  type CalendarEvent,
} from "@/lib/admin/schedule";
import {
  scheduleTypeLabel,
  scheduleTypeTone,
} from "@/lib/admin/schedule-display";
import { formatProductLabel } from "@/lib/admin/schedule-products";
import { StatusBadge } from "../_components";

function eventTimeSummary(event: CalendarEvent): string {
  return event.displayTime && event.displayTime !== "Time not set"
    ? event.displayTime
    : "Time not set";
}

export function ScheduleBookingDetailsModal({
  event,
  onClose,
}: {
  event: CalendarEvent | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousOverflow = useRef<string | null>(null);
  const scrollY = useRef(0);

  useEffect(() => {
    if (!event) return;

    scrollY.current = window.scrollY;
    previousOverflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(keyboardEvent: KeyboardEvent) {
      if (keyboardEvent.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow.current ?? "";
      window.scrollTo({ top: scrollY.current });
    };
  }, [event, onClose]);

  if (!event) return null;

  return (
    <div
      className="schedule-modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 sm:items-center print:hidden"
      role="presentation"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`schedule-modal max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-5 shadow-xl ${scheduleTypeTone(event.type)}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-950">
                {scheduleTypeLabel(event.type)}
              </span>
              <StatusBadge status={event.status} />
            </div>
            <h2 id={titleId} className="mt-3 text-xl font-black text-slate-950">
              {event.customer}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            Close
          </button>
        </div>

        {event.products.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1">
            {event.products.map((product) => (
              <li
                key={`${product.rentalItem}-${product.name}`}
                className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-bold"
              >
                {formatProductLabel(product)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm font-bold text-slate-900">{event.title}</p>
        )}

        {event.phone ? (
          <p className="mt-2 text-xs font-black text-slate-700">
            Phone: {event.phone}
          </p>
        ) : null}

        <dl className="mt-4 grid gap-2 text-xs font-semibold leading-relaxed text-slate-700">
          <div>
            <dt className="font-black uppercase tracking-wide text-slate-500">
              Time
            </dt>
            <dd className="break-words">{eventTimeSummary(event)}</dd>
          </div>
          {event.room ? (
            <div>
              <dt className="font-black uppercase tracking-wide text-slate-500">
                Room
              </dt>
              <dd className="break-words">{event.room}</dd>
            </div>
          ) : null}
          {event.location ? (
            <div>
              <dt className="font-black uppercase tracking-wide text-slate-500">
                Location
              </dt>
              <dd className="break-words">{event.location}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-4 grid gap-2 border-t border-current/10 pt-4 text-xs">
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

        <Link
          href={
            isCancelledStatus(event.status) &&
            (event.type === "rental" || event.type === "foam-party")
              ? `/admin/rentals?status=cancelled#booking-${encodeURIComponent(event.bookingId)}`
              : event.detailHref
          }
          className="mt-5 inline-flex rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400"
        >
          {isCancelledStatus(event.status) &&
          (event.type === "rental" || event.type === "foam-party")
            ? "Open Rentals dashboard to restore"
            : "Open full details"}
        </Link>
      </div>
    </div>
  );
}
