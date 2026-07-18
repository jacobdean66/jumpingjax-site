"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";

import {
  productSummary,
  type WorkspaceStop,
} from "@/lib/admin/delivery-planner-workspace";
import "./route-planner-theme.css";

function formatTime(value: string | null): string {
  if (!value) return "Not provided";
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value;
  const hour = Number(match[1]);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${match[2]} ${suffix}`;
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="rp-panel-meta text-[10px] font-black uppercase tracking-[0.12em]">
        {label}
      </dt>
      <dd className="rp-task-title mt-0.5 break-words text-sm font-semibold">
        {children}
      </dd>
    </div>
  );
}

export function RoutePlannerDetailsModal({
  stop,
  onClose,
}: {
  stop: WorkspaceStop | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousOverflow = useRef("");

  useEffect(() => {
    if (!stop) return;
    previousOverflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow.current;
    };
  }, [stop, onClose]);

  if (!stop) return null;

  const bookingHref = `/admin/rentals?from=${encodeURIComponent(stop.eventDate)}&to=${encodeURIComponent(stop.eventDate)}#booking-${encodeURIComponent(stop.bookingId)}`;
  const trailer = stop.truck === "truck-1"
    ? "Trailer 1 · Short Trailer"
    : stop.truck === "truck-2"
      ? "Trailer 2 · Long Trailer"
      : "Unassigned";

  return (
    <div
      className="rp-modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-3 sm:items-center print:hidden"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="rp-modal flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border-2 border-slate-500 bg-white shadow-2xl"
      >
        <header className="rp-panel-head flex items-start justify-between gap-4 border-b-2 px-5 py-4">
          <div>
            <p className="rp-eyebrow text-[10px] font-black uppercase tracking-[0.14em]">
              {stop.workType === "delivery" ? "Drop-off details" : "Pickup details"}
            </p>
            <h2 id={titleId} className="rp-panel-title mt-1 text-xl font-black">
              {stop.customerName}
            </h2>
            <p className="rp-task-meta mt-1 text-sm font-bold">
              {productSummary(stop.products)}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rp-btn rounded-lg px-3 py-1.5 text-xs font-black focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Customer phone">
              {stop.customerPhone ? (
                <a className="rp-link underline" href={`tel:${stop.customerPhone}`}>
                  {stop.customerPhone}
                </a>
              ) : "Not provided"}
            </Detail>
            <Detail label="Customer email">
              {stop.customerEmail ? (
                <a className="rp-link underline" href={`mailto:${stop.customerEmail}`}>
                  {stop.customerEmail}
                </a>
              ) : "Not provided"}
            </Detail>
            <Detail label="Complete address">{stop.eventAddress ?? "Not provided"}</Detail>
            <Detail label="County">{stop.county}</Detail>
            <Detail label="Products">{stop.products.join(", ")}</Detail>
            <Detail label="Requested time">
              {formatTime(stop.requestedTime)}
              <span className="rp-task-meta mt-0.5 block text-xs font-medium">
                Customer request, not a guaranteed route time
              </span>
            </Detail>
            <Detail label="Work type">
              {stop.workType === "delivery" ? "Drop-off / Delivery" : "Pickup"}
            </Detail>
            <Detail label="Trailer assignment">{trailer}</Detail>
            <Detail label="Current sequence">{stop.sequence ?? "Not assigned"}</Detail>
            <Detail label="Route status">{stop.routeStatus ?? "Not set"}</Detail>
            <Detail label="Booking status">{stop.bookingStatus}</Detail>
            <Detail label="Route notes">{stop.routeNotes ?? "None"}</Detail>
            <Detail label="Customer notes">{stop.customerNotes ?? "None"}</Detail>
          </dl>

          {stop.conflictMessages.length > 0 ? (
            <div className="mt-5 rounded-xl border-2 border-amber-400 bg-amber-50 p-3">
              <p className="text-xs font-black uppercase tracking-wide text-amber-950">
                Conflict warnings
              </p>
              <ul className="mt-2 grid gap-1 text-sm font-semibold text-amber-950">
                {stop.conflictMessages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <footer className="rp-panel-head border-t-2 px-5 py-3">
          <Link
            href={bookingHref}
            className="rp-btn-primary inline-flex rounded-lg px-4 py-2 text-sm font-black"
          >
            Open complete booking details
          </Link>
        </footer>
      </section>
    </div>
  );
}
