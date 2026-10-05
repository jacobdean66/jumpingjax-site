"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { ChevronDown, MapPin } from "lucide-react";
export function RentalBookingSquare({ id, rentalNames, city, date, customerName, bookingStatus, agreementLabel, agreementTone, children }: {
  id: string; rentalNames: string; city: string; date: string; customerName: string;
  bookingStatus: ReactNode; agreementLabel: string; agreementTone: string; children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const reveal = () => { if (window.location.hash === `#booking-${id}` && ref.current) ref.current.open = true; };
    reveal(); window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, [id]);
  return <details ref={ref} id={`booking-${id}`} name="rental-bookings" data-rental-square className="group min-w-0 scroll-mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-cyan-500 hover:shadow-md open:col-span-full open:border-cyan-600 open:shadow-lg print:hidden">
    <summary className="flex min-h-48 aspect-square cursor-pointer list-none flex-col justify-between gap-3 p-3 sm:p-4 group-open:aspect-auto group-open:min-h-0 group-open:flex-row group-open:flex-wrap group-open:items-center group-open:bg-cyan-50 [&::-webkit-details-marker]:hidden">
      <div className="min-w-0"><div className="flex flex-wrap items-center justify-between gap-1">{bookingStatus}<ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-180" aria-hidden="true" /></div><h2 className="mt-3 break-words text-base font-black leading-snug text-slate-950">{rentalNames}</h2><p className="mt-2 flex items-center gap-1 text-sm font-bold text-cyan-800"><MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />{city}</p></div>
      <div className="min-w-0"><p className="text-sm font-bold text-slate-900">{date}</p><p className="mt-1 break-words text-xs text-slate-500">{customerName} · #{id}</p><p className={`mt-2 inline-block rounded-md px-2 py-1 text-xs font-bold ${agreementTone}`}>{agreementLabel}</p></div>
    </summary><div className="border-t border-cyan-100">{children}</div>
  </details>;
}
