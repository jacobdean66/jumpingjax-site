"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { StatusBadge } from "../_components";

export type ScheduleEvent = {
  id: string;
  kind: "rental" | "facility";
  title: string;
  customerName: string;
  status: string;
  date: string;
  time: string;
  detailHref: string;
  details: { label: string; value: string }[];
};

const OPEN_EVENT = "jumpingjax:schedule-event-open";

export function ScheduleEventDetails({ event }: { event: ScheduleEvent }) {
  const [open, setOpen] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeWhenOtherOpens(rawEvent: Event) {
      const detailEvent = rawEvent as CustomEvent<{ id?: string }>;
      if (detailEvent.detail?.id !== event.id) setOpen(false);
    }

    window.addEventListener(OPEN_EVENT, closeWhenOtherOpens);
    return () => window.removeEventListener(OPEN_EVENT, closeWhenOtherOpens);
  }, [event.id]);

  const tone =
    event.kind === "rental"
      ? "border-sky-200 bg-sky-50 text-sky-950"
      : "border-pink-200 bg-pink-50 text-pink-950";

  return (
    <details
      ref={detailsRef}
      open={open}
      onToggle={() => {
        const nextOpen = detailsRef.current?.open === true;
        setOpen(nextOpen);
        if (nextOpen) {
          window.dispatchEvent(
            new CustomEvent(OPEN_EVENT, { detail: { id: event.id } }),
          );
        }
      }}
      className={`rounded-xl border px-3 py-2 text-sm ${tone}`}
    >
      <summary className="cursor-pointer list-none font-black">
        <span className="mr-2 inline-flex rounded-full bg-white/80 px-2 py-0.5 text-[10px] uppercase tracking-wide">
          {event.kind === "rental" ? "Rental" : "Facility"}
        </span>
        {event.time} - {event.customerName}
      </summary>
      <div className="mt-3 space-y-2 border-t border-current/10 pt-3">
        <p className="font-black">{event.title}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {event.details.map((detail) => (
            <div key={detail.label}>
              <p className="text-[10px] font-black uppercase tracking-wide opacity-70">
                {detail.label}
              </p>
              <p className="font-semibold">{detail.value}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <StatusBadge status={event.status} />
          <Link
            href={event.detailHref}
            className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-black text-white hover:bg-slate-800"
          >
            Open full details
          </Link>
        </div>
      </div>
    </details>
  );
}
