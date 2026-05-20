"use client";

import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { useEffect, useMemo, useState } from "react";

import {
  FACILITY_PARTY_BUFFER_MINUTES,
  FACILITY_ROOMS,
  PRIVATE_DURATION_OPTIONS,
  PRIVATE_PARTY_ROOM_ID,
} from "@/lib/facility-parties/constants";
import {
  listPrivateSlotDispositions,
  listPublicSaturdaySlotDispositions,
} from "@/lib/facility-parties/availability";
import type {
  FacilityPartyBookingBlock,
  FacilityPartyBookingRequest,
  FacilityPartyKind,
  FacilityRoomId,
  PrivateDurationMinutes,
} from "@/lib/facility-parties/types";
import { formatMinutesLabel, getLocalDayOfWeek } from "@/lib/facility-parties/time";

const controlClassName =
  "w-full rounded-xl border border-white/15 bg-[#071326]/80 px-3 py-3 text-base text-white outline-none ring-cyan-400/0 transition placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/30";

const inputClassName = `mt-1.5 ${controlClassName}`;

const PARTY_KIND_CHOICES: {
  id: FacilityPartyKind;
  title: string;
  description: string;
}[] = [
  {
    id: "public",
    title: "Public Play Party",
    description:
      "Available during open hours (Wednesday–Saturday). Choose from two party rooms. 1.5 hour time slots.",
  },
  {
    id: "private",
    title: "Private Party (Full Facility)",
    description:
      "Book the entire facility. Available evenings, Sundays, and anytime Monday–Tuesday. Choose 1.5, 2, or 3 hour slots.",
  },
];

type FacilityBookingRangeResponse = {
  id: string;
  party_kind: string;
  room: string | null;
  start_time: string;
  end_time: string;
  status: string;
};

function isFacilityPartyKind(value: string): value is FacilityPartyKind {
  return value === "public" || value === "private";
}

function isFacilityRoomId(value: string | null): value is FacilityRoomId {
  return value === "room-10" || value === "room-20";
}

function dateAllowedForKind(kind: FacilityPartyKind, isoDate: string): boolean {
  if (!isoDate) return false;

  const day = getLocalDayOfWeek(isoDate);

  if (kind === "public") {
    // Public allowed Wed–Sat only
    return day >= 3 && day <= 6;
  }

  // Private allowed all days
  return true;
}

function minutesToIsoDateTime(date: string, minutes: number) {
  const [year, month, day] = date.split("-").map(Number);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return new Date(year, month - 1, day, h, m).toISOString();
}

function dateToYmd(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateTimeToMinutes(value: string) {
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes();
}

function bookingRangeToBlock(
  booking: FacilityBookingRangeResponse,
): FacilityPartyBookingBlock | null {
  if (
    booking.status !== "confirmed" ||
    !isFacilityPartyKind(booking.party_kind)
  ) {
    return null;
  }

  const startDate = new Date(booking.start_time);
  const endDate = new Date(booking.end_time);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime())
  ) {
    return null;
  }

  return {
    id: booking.id,
    kind: booking.party_kind,
    date: dateToYmd(startDate),
    roomId: isFacilityRoomId(booking.room) ? booking.room : null,
    startMinutes: dateTimeToMinutes(booking.start_time),
    endMinutes: dateTimeToMinutes(booking.end_time),
    status: "confirmed",
  };
}

function formatReadableTimeRange(startMinutes: number, endMinutes: number) {
  return `${formatMinutesLabel(startMinutes)} - ${formatMinutesLabel(endMinutes)}`;
}

export function FacilityPartyBookingForm() {
  const [blocks, setBlocks] = useState<FacilityPartyBookingBlock[]>([]);
  const [partyKind, setPartyKind] = useState<FacilityPartyKind | null>(null);
  const [roomId, setRoomId] = useState<FacilityRoomId>("room-10");
  const [privateDuration, setPrivateDuration] =
    useState<PrivateDurationMinutes>(90);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [availabilityLoadError, setAvailabilityLoadError] = useState<
    string | null
  >(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [bookingSubmitted, setBookingSubmitted] = useState(false);

  const date = selectedDate ? dateToYmd(selectedDate) : "";
  const dateOk = partyKind ? dateAllowedForKind(partyKind, date) : false;

  const slotDispositions = useMemo(() => {
    if (!date || !dateOk) {
      return [];
    }
    if (partyKind === "public") {
      return listPublicSaturdaySlotDispositions(date, roomId, blocks);
    }
    return listPrivateSlotDispositions(date, privateDuration, blocks);
  }, [partyKind, date, dateOk, roomId, privateDuration, blocks]);

  const selectedDisposition = useMemo(
    () =>
      slotDispositions.find(
        (d) => d.startMinutes === selectedStart && d.available,
      ) ?? null,
    [slotDispositions, selectedStart],
  );

  useEffect(() => {
    if (!date) {
      return;
    }

    const fetchUnavailable = async () => {
      setAvailabilityLoading(true);
      setAvailabilityLoadError(null);
      try {
        const res = await fetch(
          `/api/facility/unavailable?date=${encodeURIComponent(date)}`,
        );
        if (!res.ok) {
          throw new Error("Failed to fetch unavailable dates");
        }
        const data = await res.json();
        const bookings = Array.isArray(data) ? data : [];
        const liveBlocks = bookings
          .map((booking) =>
            bookingRangeToBlock(booking as FacilityBookingRangeResponse),
          )
          .filter(
            (block): block is FacilityPartyBookingBlock => Boolean(block),
          );

        setBlocks(liveBlocks);
        setAvailabilityLoadError(null);
      } catch (err) {
        console.error("Failed to fetch unavailable dates", err);
        setSelectedStart(null);
        setAvailabilityLoadError(
          "Availability could not be loaded. Please try again.",
        );
      } finally {
        setAvailabilityLoading(false);
      }
    };

    fetchUnavailable();
  }, [date]);

  const availabilityUnavailable =
    Boolean(availabilityLoadError) || availabilityLoading;
  const customerStepUnlocked =
    Boolean(selectedDisposition) && !availabilityUnavailable;

  const onPartyKindChange = (next: FacilityPartyKind) => {
    setPartyKind(next);
    setSelectedDate(undefined);
    setSelectedStart(null);
    setBlocks([]);
    setAvailabilityLoadError(null);
    setFormError(null);
    setSuccessMessage(null);
    if (next === "private") {
      setRoomId(PRIVATE_PARTY_ROOM_ID);
    }
  };

  const onDateSelect = (nextDate: Date | undefined) => {
    setSelectedDate(nextDate);
    setSelectedStart(null);
    setAvailabilityLoadError(null);
    if (!nextDate) {
      setBlocks([]);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!date) {
      setFormError("Choose a date to continue.");
      return;
    }
    if (!dateOk) {
      setFormError(
        partyKind === "public"
          ? "Public play parties need a Wednesday through Saturday date."
          : "Private parties are available all days.",
      );
      return;
    }
    if (availabilityLoadError) {
      setFormError(availabilityLoadError);
      return;
    }
    if (availabilityLoading) {
      setFormError("Availability is still loading. Please try again.");
      return;
    }
    if (!selectedDisposition) {
      setFormError("Pick an open time slot to continue.");
      return;
    }
    if (partyKind === "public" && !roomId) {
      setFormError("Select which play room you want.");
      return;
    }
    if (!customerName.trim() || !customerEmail.trim() || !customerPhone.trim()) {
      setFormError("Add your name, email, and phone so we can follow up.");
      return;
    }

    const resolvedRoomId =
      partyKind === "public" ? roomId : PRIVATE_PARTY_ROOM_ID;

    const request: FacilityPartyBookingRequest = {
      kind: partyKind as FacilityPartyKind,
      date,
      roomId: resolvedRoomId,
      durationMinutes:
        selectedDisposition.endMinutes - selectedDisposition.startMinutes,
      startMinutes: selectedDisposition.startMinutes,
      endMinutes: selectedDisposition.endMinutes,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim(),
      notes: notes.trim(),
      status: "pending",
    };

    try {
      const res = await fetch("/api/facility/book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          party_kind: request.kind,
          room: request.roomId,
          start_time: minutesToIsoDateTime(request.date, request.startMinutes),
          end_time: minutesToIsoDateTime(request.date, request.endMinutes),
          customer_name: request.customerName,
          email: request.customerEmail,
          phone: request.customerPhone,
          notes: request.notes,
          readable_date: request.date,
          readable_time: formatReadableTimeRange(
            selectedDisposition.startMinutes,
            selectedDisposition.endMinutes,
          ),
          party_label:
            request.kind === "private" ? "Private Party" : "Public Play Party",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to book");
      }

      setBookingSubmitted(true);
    } catch {
      setFormError("Something went wrong. Please try again.");
    }
  };

  const publicRooms = FACILITY_ROOMS;
  const submittedPartyLabel =
    partyKind === "private" ? "Private Party" : "Public Play Party";
  const submittedReadableTime = selectedDisposition
    ? formatReadableTimeRange(
        selectedDisposition.startMinutes,
        selectedDisposition.endMinutes,
      )
    : "";

  if (bookingSubmitted) {
    return (
      <div className="mx-auto mt-12 w-full max-w-2xl rounded-3xl border border-emerald-300/25 bg-emerald-300/[0.06] p-5 text-left sm:mt-14 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">
          Request Submitted!
        </p>
        <div className="mt-5 space-y-3 text-sm leading-relaxed text-slate-200">
          <p>A confirmation request has been sent to our team.</p>
          <p>You will receive an email shortly with your booking details.</p>
          <p>
            A second email will be sent once your booking is confirmed.
          </p>
        </div>
        <div className="mt-6 rounded-2xl border border-white/10 bg-[#071326]/55 p-4 text-sm text-slate-300">
          <p className="font-semibold text-white">{submittedPartyLabel}</p>
          {date && <p className="mt-2">Date: {date}</p>}
          {submittedReadableTime && (
            <p className="mt-1">Time: {submittedReadableTime}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto mt-12 w-full max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-left sm:mt-14 sm:p-8"
    >
      <header className="space-y-3">
        <h2 className="text-lg font-black uppercase tracking-wide text-cyan-200 sm:text-xl">
          Request a party
        </h2>
        <p className="text-sm leading-relaxed text-slate-400">
          Send a booking request — no online payment. Availability below updates
          locally for this preview.
        </p>
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-sm leading-relaxed text-slate-200">
          <p className="font-semibold text-cyan-100">Scheduling notes</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-slate-300">
            <li>Saturday daytime uses fixed shared party slots in each play room.</li>
            <li>
              Whole-facility visits are spaced automatically (one group at a
              time).
            </li>
            <li>
              A {FACILITY_PARTY_BUFFER_MINUTES}-minute setup buffer is included
              between back-to-back bookings.
            </li>
          </ul>
        </div>
      </header>

      <div className="mt-10 space-y-10">
        {/* 1. Party type */}
        <section className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            1 · Party type
          </p>
          <div className="flex flex-col gap-3">
            {PARTY_KIND_CHOICES.map((opt) => {
              const active = partyKind === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onPartyKindChange(opt.id)}
                  className={`rounded-2xl border px-4 py-4 text-left transition active:scale-[0.99] ${
                    active
                      ? "border-cyan-400/70 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(34,211,238,0.15)]"
                      : "border-white/10 bg-[#071326]/50 hover:border-white/25"
                  }`}
                >
                  <span className="block text-base font-semibold text-white">
                    {opt.title}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-slate-400">
                    {opt.description}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        {!partyKind && (
          <p className="text-sm text-slate-400">
            Choose public or private to continue.
          </p>
        )}

        {/* 2. Room */}
        <section className={`space-y-3 ${!partyKind ? "opacity-50 pointer-events-none" : ""}`}>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            2 · Party space
          </p>
          {partyKind === "public" ? (
            <>
              <p className="text-sm text-slate-400">
                The smaller room is only offered for Saturday daytime visits.
                Choose the space that fits your headcount.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {publicRooms.map((room) => {
                  const active = roomId === room.id;
                  return (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => {
                        setRoomId(room.id);
                        setSelectedStart(null);
                      }}
                      className={`rounded-2xl border px-4 py-4 text-left transition active:scale-[0.99] ${
                        active
                          ? "border-cyan-400/70 bg-cyan-400/10"
                          : "border-white/10 bg-[#071326]/50 hover:border-white/25"
                      }`}
                    >
                      <span className="block text-sm font-semibold text-white">
                        {room.id === "room-10"
                          ? "Smaller play room"
                          : "Larger play room"}
                      </span>
                      <span className="mt-1 block text-xs text-slate-400">
                        Up to {room.maxKids} kids · {room.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[#071326]/55 px-4 py-4 text-sm leading-relaxed text-slate-300">
              <p className="font-semibold text-white">Whole facility · larger party space</p>
              <p className="mt-2">
                Evening and Sunday visits always use our larger private party
                area (up to 20 kids). The smaller room is not offered for these
                times.
              </p>
            </div>
          )}
        </section>

        {/* 3. Duration */}
        <section className={`space-y-3 ${!partyKind ? "opacity-50 pointer-events-none" : ""}`}>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            3 · Length
          </p>
          {partyKind === "public" ? (
            <div className="rounded-2xl border border-white/10 bg-[#071326]/50 px-4 py-4">
              <p className="text-sm font-semibold text-white">
                About 1.5 hours per daytime slot
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Saturday windows are preset. The{" "}
                {FACILITY_PARTY_BUFFER_MINUTES}-minute setup buffer between
                parties is already built in.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              {PRIVATE_DURATION_OPTIONS.map((opt) => {
                const active = privateDuration === opt.minutes;
                return (
                  <button
                    key={opt.minutes}
                    type="button"
                    onClick={() => {
                      setPrivateDuration(opt.minutes);
                      setSelectedStart(null);
                    }}
                    className={`flex-1 rounded-2xl border px-4 py-4 text-left text-sm font-semibold transition active:scale-[0.99] ${
                      active
                        ? "border-cyan-400/70 bg-cyan-400/10 text-white"
                        : "border-white/10 bg-[#071326]/50 text-slate-200 hover:border-white/25"
                    }`}
                  >
                    {opt.label}
                    <span className="mt-1 block text-xs font-normal text-slate-400">
                      {opt.minutes === 90
                        ? "Great for most celebrations"
                        : "Extra play time on Sundays especially"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* 4. Date */}
        <section className={`space-y-3 ${!partyKind ? "opacity-50 pointer-events-none" : ""}`}>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            4 · Date
          </p>
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={onDateSelect}
            disabled={(date) => {
              if (!partyKind) return true;

              const day = date.getDay();

              if (partyKind === "public") {
                return (
                  day === 0 ||
                  day === 1 ||
                  day === 2
                );
              }

              return false;
            }}
            modifiersClassNames={{
              disabled: "opacity-30 cursor-not-allowed",
            }}
          />
          <p className="text-xs text-slate-500">
            {partyKind === "public"
              ? "Saturday daytime shared slots only."
              : "Private slots are available after public closing, Sunday from 10:30 AM, and all day Monday–Tuesday."}
          </p>
        </section>

        {/* 5. Available times */}
        <section className={`space-y-3 ${!partyKind ? "opacity-50 pointer-events-none" : ""}`}>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              5 · Available times
            </p>
            {partyKind === "public" && dateOk && (
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Saturday daytime shared party slots
              </span>
            )}
            {partyKind === "private" && dateOk && (
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Private starts every 30 minutes
              </span>
            )}
          </div>

          {!date && (
            <p className="text-sm text-slate-500">Pick a date to load times.</p>
          )}
          {date && !dateOk && (
            <p className="rounded-2xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-100">
              {partyKind === "public"
                ? "Choose a date to see available time slots."
                : "Choose a Friday, Saturday, or Sunday for evening or Sunday visits."}
            </p>
          )}
          {date && dateOk && availabilityLoadError && (
            <p className="rounded-2xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-sm text-amber-100">
              {availabilityLoadError}
            </p>
          )}
          {date && dateOk && !availabilityUnavailable && slotDispositions.length === 0 && (
            <p className="text-sm text-slate-400">
              No times to show for this day and party type.
            </p>
          )}
          {date && dateOk && slotDispositions.length > 0 && (
            <div
              className={`grid gap-2 sm:grid-cols-2 ${
                partyKind === "private"
                  ? "max-h-64 overflow-y-auto pr-1 sm:max-h-80"
                  : ""
              }`}
            >
              {slotDispositions.map((slot) => {
                const selected =
                  slot.available && selectedStart === slot.startMinutes;
                const unavailableClasses =
                  "cursor-not-allowed border-white/5 bg-white/[0.02] text-slate-500 opacity-60";

                return (
                  <button
                    key={`${slot.startMinutes}-${slot.endMinutes}`}
                    type="button"
                    disabled={!slot.available || availabilityUnavailable}
                    onClick={() => {
                      if (!slot.available || availabilityUnavailable) {
                        return;
                      }
                      setSelectedStart(slot.startMinutes);
                      setFormError(null);
                    }}
                    className={`relative rounded-2xl border px-4 py-4 text-left transition ${
                      slot.available && !availabilityUnavailable
                        ? selected
                          ? "border-cyan-400 bg-cyan-400/15 text-white shadow-[0_0_0_1px_rgba(34,211,238,0.35)]"
                          : "border-white/15 bg-[#071326]/60 text-white hover:border-cyan-300/40 active:scale-[0.99]"
                        : unavailableClasses
                    }`}
                  >
                    <span className="block text-sm font-semibold">
                      {slot.label}
                    </span>
                    <span
                      className={`mt-1 block text-xs ${
                        slot.available && !availabilityUnavailable
                          ? "text-slate-400"
                          : "text-slate-600"
                      }`}
                    >
                      {slot.available && !availabilityUnavailable
                        ? selected
                          ? "Selected · tap to change"
                          : "Tap to select"
                        : "Booked · not available"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* 6. Customer — progressive */}
        <section
          className={`space-y-3 transition-opacity duration-200 ${
            customerStepUnlocked ? "opacity-100" : "opacity-50"
          }`}
        >
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            6 · Your details
          </p>
          {!customerStepUnlocked ? (
            <p className="rounded-2xl border border-white/10 bg-[#071326]/40 px-4 py-3 text-sm text-slate-400">
              Select an open time slot above — we&apos;ll ask for contact info
              next so the form stays easy on phones.
            </p>
          ) : (
            <div className="space-y-4 rounded-2xl border border-white/10 bg-[#071326]/50 p-4 sm:p-5">
              <div className="grid gap-4">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Full name
                  </span>
                  <input
                    type="text"
                    name="customerName"
                    autoComplete="name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className={inputClassName}
                    placeholder="Jordan Lee"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Email
                  </span>
                  <input
                    type="email"
                    name="customerEmail"
                    autoComplete="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className={inputClassName}
                    placeholder="you@example.com"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Phone
                  </span>
                  <input
                    type="tel"
                    name="customerPhone"
                    autoComplete="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className={inputClassName}
                    placeholder="(864) 555-0199"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Notes (optional)
                  </span>
                  <textarea
                    name="notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={inputClassName}
                    placeholder="Guest count, age range, special requests…"
                  />
                </label>
              </div>
            </div>
          )}
        </section>
      </div>

      {formError && (
        <p className="mt-8 text-sm font-semibold text-amber-200">{formError}</p>
      )}
      {successMessage && (
        <p className="mt-8 text-sm font-semibold text-emerald-200">
          {successMessage}
        </p>
      )}

      <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          Requests stay pending until our staff confirms them.
        </p>
        <button
          type="submit"
          disabled={!customerStepUnlocked}
          className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-6 py-3 text-sm font-black uppercase tracking-wide text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-slate-600"
        >
          Submit request
        </button>
      </div>
    </form>
  );
}
