"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  FACILITY_PARTY_BUFFER_MINUTES,
  FACILITY_ROOMS,
  PRIVATE_DURATION_OPTIONS,
  PRIVATE_PARTY_ROOM_ID,
} from "@/lib/facility-parties/constants";
import {
  canNavigateFacilityBookingMonth,
  facilityBookingHorizonEnd,
  isDateWithinFacilityBookingHorizon,
  startOfFacilityBookingMonth,
} from "@/lib/facility-parties/booking-horizon";
import {
  listPrivateSlotDispositions,
  listPublicSaturdaySlotDispositions,
} from "@/lib/facility-parties/availability";
import {
  previewAddonSubtotal,
  type CottonCandyPackage,
  type FacilityAddonSelectionsInput,
} from "@/lib/facility-parties/addons";
import {
  formatFacilityPricingLines,
  priceFacilityPartyWithConfig,
  type FacilityPricingConfig,
} from "@/lib/facility-parties/pricing";
import {
  FACILITY_INVITATION_CREATION_PREFERENCES,
  FACILITY_INVITATION_DELIVERY_OPTIONS,
  invitationCreationPreferenceLabel,
  normalizeInvitationTemplateId,
  type FacilityInvitationCreationPreference,
  type FacilityInvitationDeliveryPreference,
  type FacilityInvitationTemplateId,
} from "@/lib/facility-parties/invitations";
import type {
  FacilityPartyBookingBlock,
  FacilityPartyBookingRequest,
  FacilityPartyKind,
  FacilityRoomId,
  PrivateDurationMinutes,
} from "@/lib/facility-parties/types";
import { formatMinutesLabel, getLocalDayOfWeek } from "@/lib/facility-parties/time";
import { InvitationDeliveryPreview } from "@/components/facility-parties/InvitationDeliveryPreview";
import { PartyInvitationCard } from "@/components/facility-parties/PartyInvitationCard";
import {
  advanceInvitationSnapshot,
  invitationSnapshotFromChoice,
  remainingInvitationAlternates,
} from "@/lib/facility-parties/invitations/snapshot";
import {
  mapFacilityAvailabilityRowToBlock,
  type FacilityAvailabilityRow,
} from "@/lib/facility-parties/availability-source";

const controlClassName =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base text-slate-950 outline-none ring-cyan-400/0 transition placeholder:text-slate-500 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200";

const inputClassName = `mt-1.5 ${controlClassName}`;

const FACILITY_DRINK_CHOICES = [
  "Capri-Sun",
  "Kool-Aid Jammers",
  "Gatorade",
  "Soda",
  "Huggs",
] as const;

const PAYMENT_METHOD_CHOICES = ["Cash", "Card"] as const;
const CHILD_GENDER_CHOICES = ["Boy", "Girl"] as const;

const PARTY_KIND_CHOICES: {
  id: FacilityPartyKind;
  title: string;
  description: string;
}[] = [
  {
    id: "public",
    title: "Public Play Party",
    description:
      "Available during open hours (Wednesday-Saturday). Choose the 10 kid party room or 20 kid party room. 1.5 hour time slots.",
  },
  {
    id: "private",
    title: "Private Party (Full Facility)",
    description:
      "Book the entire facility. Available evenings, Sundays, and anytime Monday–Tuesday. Choose 1.5, 2, or 3 hour slots.",
  },
];

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

function dateToYmd(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatReadableTimeRange(startMinutes: number, endMinutes: number) {
  return `${formatMinutesLabel(startMinutes)} - ${formatMinutesLabel(endMinutes)}`;
}

type FacilityPartyBookingFormProps = {
  pricingConfig: FacilityPricingConfig;
};

export function FacilityPartyBookingForm({
  pricingConfig,
}: FacilityPartyBookingFormProps) {
  const confirmationRef = useRef<HTMLDivElement | null>(null);
  const searchParams = useSearchParams();
  const urlTheme = searchParams.get("theme")?.trim() ?? "";
  const urlChild = searchParams.get("child")?.trim() ?? "";
  const urlAge = searchParams.get("age")?.trim() ?? "";
  const [blocks, setBlocks] = useState<FacilityPartyBookingBlock[]>([]);
  const [partyKind, setPartyKind] = useState<FacilityPartyKind | null>(null);
  const [roomId, setRoomId] = useState<FacilityRoomId>("room-10");
  const [privateDuration, setPrivateDuration] =
    useState<PrivateDurationMinutes>(90);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [localToday] = useState(() => new Date());
  const [displayedMonth, setDisplayedMonth] = useState(() =>
    startOfFacilityBookingMonth(new Date()),
  );
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [parentName, setParentName] = useState("");
  const [childNameDraft, setChildNameDraft] = useState<string | null>(null);
  const [childGender, setChildGender] = useState("");
  const [childAgeDraft, setChildAgeDraft] = useState<string | null>(null);
  const [partyThemeDraft, setPartyThemeDraft] = useState<string | null>(null);
  const childName = childNameDraft ?? urlChild;
  const childAge = childAgeDraft ?? urlAge;
  const partyTheme = partyThemeDraft ?? urlTheme;
  const setChildName = (value: string) => setChildNameDraft(value);
  const setChildAge = (value: string) => setChildAgeDraft(value);
  const setPartyTheme = (value: string) => setPartyThemeDraft(value);
  const [invitationOverride, setInvitationOverride] = useState<{
    sourceText: string;
    optionIndex: number;
    alternatesUsed: number;
  } | null>(null);
  const [balloonColors, setBalloonColors] = useState("");
  const [tableClothColors, setTableClothColors] = useState("");
  const [drinkChoice, setDrinkChoice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [invitationDeliveryPreference, setInvitationDeliveryPreference] =
    useState<FacilityInvitationDeliveryPreference>("print");
  const [invitationCreationPreference, setInvitationCreationPreference] =
    useState<FacilityInvitationCreationPreference | null>(null);
  const [invitationTemplateId, setInvitationTemplateId] =
    useState<FacilityInvitationTemplateId>("spotlight");
  const [depositAcknowledged, setDepositAcknowledged] = useState(false);
  const [notes, setNotes] = useState("");
  const [balloonsSelected, setBalloonsSelected] = useState(false);
  const [goodieBagsSelected, setGoodieBagsSelected] = useState(false);
  const [goodieBagsQuantity, setGoodieBagsQuantity] = useState(1);
  const [cottonCandyPackage, setCottonCandyPackage] =
    useState<CottonCandyPackage>("none");
  const [formError, setFormError] = useState<string | null>(null);
  const [availabilityLoadError, setAvailabilityLoadError] = useState<
    string | null
  >(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [bookingSubmitted, setBookingSubmitted] = useState(false);
  const submitIdempotencyKey = useRef<string | null>(null);

  const date = selectedDate ? dateToYmd(selectedDate) : "";
  const dateOk = partyKind ? dateAllowedForKind(partyKind, date) : false;
  const canGoToPreviousMonth = canNavigateFacilityBookingMonth(
    displayedMonth,
    "previous",
    localToday,
  );
  const canGoToNextMonth = canNavigateFacilityBookingMonth(
    displayedMonth,
    "next",
    localToday,
  );
  const displayedMonthLabel = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(displayedMonth);

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

  const invitationSnapshot = useMemo(() => {
    const trimmed = partyTheme.trim();
    if (
      invitationOverride &&
      invitationOverride.sourceText === trimmed
    ) {
      return invitationSnapshotFromChoice(
        partyTheme,
        invitationOverride.optionIndex,
        invitationOverride.alternatesUsed,
      );
    }
    return invitationSnapshotFromChoice(partyTheme, 0, 0);
  }, [partyTheme, invitationOverride]);

  const invitationDateLabel = selectedDate
    ? new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(selectedDate)
    : "";
  const invitationTimeLabel = selectedDisposition
    ? formatReadableTimeRange(
        selectedDisposition.startMinutes,
        selectedDisposition.endMinutes,
      )
    : "";

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
            mapFacilityAvailabilityRowToBlock(booking as FacilityAvailabilityRow),
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

  useEffect(() => {
    if (!bookingSubmitted) {
      return;
    }

    confirmationRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    confirmationRef.current?.focus({ preventScroll: true });
  }, [bookingSubmitted]);

  const addonSelections = useMemo((): FacilityAddonSelectionsInput => {
    const qty = goodieBagsSelected
      ? Math.max(1, Math.floor(goodieBagsQuantity) || 1)
      : 0;
    return {
      customBirthdayBalloons: balloonsSelected,
      goodieBagsQuantity: qty,
      cottonCandyPackage,
    };
  }, [
    balloonsSelected,
    goodieBagsSelected,
    goodieBagsQuantity,
    cottonCandyPackage,
  ]);

  const addonSubtotalPreview = useMemo(
    () => previewAddonSubtotal(addonSelections),
    [addonSelections],
  );

  const pricingPreview = useMemo(() => {
    if (!partyKind || !date || !selectedDisposition) {
      return null;
    }

    return priceFacilityPartyWithConfig(
      {
        partyKind,
        roomId: partyKind === "public" ? roomId : PRIVATE_PARTY_ROOM_ID,
        date,
        durationMinutes:
          selectedDisposition.endMinutes - selectedDisposition.startMinutes,
        addonSubtotal: addonSubtotalPreview,
      },
      pricingConfig,
    );
  }, [
    addonSubtotalPreview,
    date,
    partyKind,
    pricingConfig,
    roomId,
    selectedDisposition,
  ]);

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

  const navigateMonth = (offset: -1 | 1) => {
    setDisplayedMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
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
      setFormError("Select which room you want.");
      return;
    }
    if (!parentName.trim() || !customerEmail.trim() || !customerPhone.trim()) {
      setFormError("Add your name, email, and phone so we can follow up.");
      return;
    }
    if (
      !parentName.trim() ||
      !childName.trim() ||
      !childGender.trim() ||
      !childAge.trim() ||
      !partyTheme.trim() ||
      !balloonColors.trim() ||
      !tableClothColors.trim() ||
      !drinkChoice.trim() ||
      !paymentMethod.trim()
    ) {
      setFormError("Add the birthday child, party detail, and payment fields.");
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
      customerName: parentName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim(),
      notes: notes.trim(),
      addonSelections,
      status: "pending",
    };

    try {
      submitIdempotencyKey.current ??= crypto.randomUUID();
      const res = await fetch("/api/facility/book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idempotency_key: submitIdempotencyKey.current,
          party_kind: request.kind,
          room: request.roomId,
          booking_date: request.date,
          start_minutes: request.startMinutes,
          end_minutes: request.endMinutes,
          customer_name: request.customerName,
          email: request.customerEmail,
          phone: request.customerPhone,
          parent_name: parentName.trim(),
          child_name: childName.trim(),
          child_gender: childGender.trim(),
          child_age: childAge.trim(),
          party_theme: partyTheme.trim(),
          invitation_option_index: invitationSnapshot.optionIndex,
          invitation_alternates_used: invitationSnapshot.alternatesUsed,
          balloon_colors: balloonColors.trim(),
          table_cloth_colors: tableClothColors.trim(),
          drink_choice: drinkChoice.trim(),
          payment_method: paymentMethod.trim(),
          invitation_delivery_preference: invitationDeliveryPreference,
          invitation_creation_preference: invitationCreationPreference,
          invitation_template_id: normalizeInvitationTemplateId(
            invitationTemplateId,
          ),
          deposit_acknowledged: depositAcknowledged,
          notes: request.notes,
          readable_date: request.date,
          readable_time: formatReadableTimeRange(
            selectedDisposition.startMinutes,
            selectedDisposition.endMinutes,
          ),
          party_label:
            request.kind === "private" ? "Private Party" : "Public Play Party",
          addon_selections: addonSelections,
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
      <div
        ref={confirmationRef}
        tabIndex={-1}
        role="status"
        className="facility-party-readable mx-auto mt-12 w-full max-w-2xl rounded-3xl border border-emerald-300/35 bg-white p-5 text-left outline-none ring-emerald-200/0 focus:ring-2 sm:mt-14 sm:p-8"
      >
        <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">
          Booking request received
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
          Watch your email for the request confirmation.
        </h2>
        <div className="mt-5 space-y-3 text-sm leading-relaxed text-slate-200">
          <p>
            We sent your party request to Jumping Jax for review, and a booking
            request email should arrive with the details you submitted.
          </p>
          <p>
            Your date is not fully confirmed until Jumping Jax approves it. A
            second email will be sent after approval.
          </p>
        </div>
        <div className="mt-6 rounded-2xl border border-white/10 bg-[#071326]/55 p-4 text-sm text-slate-300">
          <p className="font-semibold text-white">{submittedPartyLabel}</p>
          {date && <p className="mt-2">Date: {date}</p>}
          {submittedReadableTime && (
            <p className="mt-1">Time: {submittedReadableTime}</p>
          )}
          {paymentMethod && <p className="mt-1">Payment: {paymentMethod}</p>}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="facility-party-readable mx-auto mt-12 w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-[0_18px_48px_rgba(15,23,42,0.12)] sm:mt-14 sm:p-8"
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
            <li>Saturday daytime uses fixed shared party slots in each room.</li>
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
            2 · Room
          </p>
          {partyKind === "public" ? (
            <>
              <p className="text-sm text-slate-400">
                Choose the room that fits your headcount.
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
                          ? "10 kid party room"
                          : "20 kid party room"}
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
              <p className="font-semibold text-white">Whole facility · 20 kid party room</p>
              <p className="mt-2">
                Evening and Sunday visits always use the 20 kid party room. The
                10 kid party room is not offered for these times.
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
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
            <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2">
              <button
                type="button"
                aria-label="Previous month"
                disabled={!canGoToPreviousMonth}
                onClick={() => navigateMonth(-1)}
                className="group inline-flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-700 bg-cyan-600 shadow-sm transition hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:shadow-none"
              >
                <ChevronLeft
                  aria-hidden="true"
                  className="h-6 w-6 text-white group-disabled:text-slate-500"
                />
              </button>
              <p
                aria-live="polite"
                className="truncate text-center text-base font-black text-slate-950 sm:text-lg"
              >
                {displayedMonthLabel}
              </p>
              <button
                type="button"
                aria-label="Next month"
                disabled={!canGoToNextMonth}
                onClick={() => navigateMonth(1)}
                className="group inline-flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-700 bg-cyan-600 shadow-sm transition hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:shadow-none"
              >
                <ChevronRight
                  aria-hidden="true"
                  className="h-6 w-6 text-white group-disabled:text-slate-500"
                />
              </button>
            </div>
            <DayPicker
              mode="single"
              month={displayedMonth}
              onMonthChange={setDisplayedMonth}
              startMonth={startOfFacilityBookingMonth(localToday)}
              endMonth={facilityBookingHorizonEnd()}
              hideNavigation
              selected={selectedDate}
              onSelect={onDateSelect}
              disabled={(candidateDate) => {
                if (
                  !partyKind ||
                  !isDateWithinFacilityBookingHorizon(candidateDate, localToday)
                ) {
                  return true;
                }

                const day = candidateDate.getDay();

                if (partyKind === "public") {
                  return day === 0 || day === 1 || day === 2;
                }

                return false;
              }}
              modifiersClassNames={{
                disabled: "opacity-30 cursor-not-allowed",
              }}
              className="mx-auto max-w-full"
            />
          </div>
          <p className="text-xs font-semibold text-slate-600">
            Online facility party requests are currently open through December
            31, 2027.
          </p>
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
                    Parent/Guardian Full Name
                  </span>
                  <input
                    type="text"
                    name="parentName"
                    autoComplete="name"
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    className={inputClassName}
                    placeholder="Parent or guardian full name"
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
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block sm:col-span-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Birthday Child&apos;s Full Name
                    </span>
                    <input
                      type="text"
                      name="childName"
                      value={childName}
                      onChange={(e) => setChildName(e.target.value)}
                      className={inputClassName}
                      placeholder="Birthday child"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Age
                    </span>
                    <input
                      type="number"
                      name="childAge"
                      min={1}
                      max={18}
                      value={childAge}
                      onChange={(e) => setChildAge(e.target.value)}
                      className={inputClassName}
                      placeholder="Age"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Child&apos;s gender
                  </span>
                  <select
                    name="childGender"
                    required
                    value={childGender}
                    onChange={(e) => setChildGender(e.target.value)}
                    className={inputClassName}
                  >
                    <option value="">Select gender</option>
                    {CHILD_GENDER_CHOICES.map((choice) => (
                      <option key={choice} value={choice}>
                        {choice}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Party theme
                  </span>
                  <input
                    type="text"
                    name="partyTheme"
                    value={partyTheme}
                    onChange={(e) => {
                      setPartyTheme(e.target.value);
                      setInvitationOverride(null);
                    }}
                    className={inputClassName}
                    placeholder="Princess, Sonic, sports, glow party..."
                  />
                </label>
                {partyTheme.trim() ? (
                  <fieldset className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-3">
                    <legend className="px-1 text-xs font-bold uppercase tracking-wider text-cyan-200">
                      Birthday invitations
                    </legend>
                    <p className="mt-1 text-sm leading-relaxed text-slate-300">
                      Optional — create themed invitations now, or get generic
                      ones from the office later.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {FACILITY_INVITATION_CREATION_PREFERENCES.map(
                        (preference) => {
                          const active =
                            invitationCreationPreference === preference;
                          return (
                            <button
                              key={preference}
                              type="button"
                              onClick={() => {
                                setInvitationCreationPreference(preference);
                                if (preference === "office_generic") {
                                  setInvitationDeliveryPreference(
                                    "office_pickup",
                                  );
                                } else if (
                                  invitationDeliveryPreference ===
                                  "office_pickup"
                                ) {
                                  setInvitationDeliveryPreference("print");
                                }
                                // Keep a stable default template id for API compatibility.
                                setInvitationTemplateId("spotlight");
                              }}
                              className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition ${
                                active
                                  ? "border-cyan-300 bg-cyan-400/15 text-white"
                                  : "border-white/10 bg-[#071326]/55 text-slate-200 hover:border-cyan-400/40"
                              }`}
                            >
                              {invitationCreationPreferenceLabel(preference)}
                            </button>
                          );
                        },
                      )}
                    </div>
                    {invitationCreationPreference === "office_generic" ? (
                      <p className="mt-3 rounded-xl border border-white/10 bg-[#071326]/55 px-3 py-3 text-sm font-semibold text-slate-300">
                        Got it — we&apos;ll have generic invitations ready at
                        the office. No digital design needed.
                      </p>
                    ) : null}
                    {invitationCreationPreference === "create" ? (
                      <div className="mt-4 grid gap-4">
                        <div className="mx-auto w-full max-w-sm">
                          <PartyInvitationCard
                            snapshot={invitationSnapshot}
                            childName={childName}
                            childAge={childAge}
                            dateLabel={invitationDateLabel}
                            timeLabel={invitationTimeLabel}
                            compact
                          />
                        </div>
                        <p className="text-sm font-semibold text-slate-300">
                          Type a different theme above anytime to rematch. You
                          can also load a different invitation style up to three
                          times.
                        </p>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          {invitationSnapshot.alternatesLocked
                            ? "No more invitation styles left"
                            : `${remainingInvitationAlternates(invitationSnapshot)} of 3 other styles left`}
                        </p>
                        <button
                          type="button"
                          disabled={invitationSnapshot.alternatesLocked}
                          onClick={() => {
                            const next =
                              advanceInvitationSnapshot(invitationSnapshot);
                            setInvitationOverride({
                              sourceText: next.sourceText,
                              optionIndex: next.optionIndex,
                              alternatesUsed: next.alternatesUsed,
                            });
                          }}
                          className="w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-500 disabled:text-slate-200"
                        >
                          I don&apos;t like this — show another
                        </button>
                        {invitationSnapshot.alternatesLocked ? (
                          <p className="text-sm font-semibold text-slate-200">
                            This is the last invitation style we can show. It
                            will be saved with your booking.
                          </p>
                        ) : null}
                        <div className="grid gap-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-cyan-100">
                            Choose how you want invitations
                          </p>
                          <div
                            role="radiogroup"
                            aria-label="Invitation delivery method"
                            className="grid grid-cols-1 gap-3 md:grid-cols-3"
                          >
                            {FACILITY_INVITATION_DELIVERY_OPTIONS.map(
                              (option) => {
                                const active =
                                  invitationDeliveryPreference === option.id;
                                return (
                                  <label
                                    key={option.id}
                                    className="group relative block min-h-[44px] cursor-pointer rounded-2xl focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-cyan-300"
                                  >
                                    <input
                                      type="radio"
                                      name="invitationDeliveryPreference"
                                      value={option.id}
                                      checked={active}
                                      onChange={() =>
                                        setInvitationDeliveryPreference(
                                          option.id,
                                        )
                                      }
                                      className="sr-only"
                                      aria-label={`${option.label}. ${option.description}`}
                                    />
                                    <InvitationDeliveryPreview
                                      preference={option.id}
                                      active={active}
                                      snapshot={invitationSnapshot}
                                      childName={childName}
                                      childAge={childAge}
                                      dateLabel={invitationDateLabel}
                                      timeLabel={invitationTimeLabel}
                                    />
                                    <span className="mt-2 block px-0.5 text-xs font-semibold leading-snug text-slate-300">
                                      <span className="block text-sm font-black text-white">
                                        {option.label}
                                      </span>
                                      {option.description}
                                    </span>
                                  </label>
                                );
                              },
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </fieldset>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Balloon colors
                    </span>
                    <input
                      type="text"
                      name="balloonColors"
                      value={balloonColors}
                      onChange={(e) => setBalloonColors(e.target.value)}
                      className={inputClassName}
                      placeholder="Pink, purple, white"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Table cloth colors
                    </span>
                    <input
                      type="text"
                      name="tableClothColors"
                      value={tableClothColors}
                      onChange={(e) => setTableClothColors(e.target.value)}
                      className={inputClassName}
                      placeholder="Blue and silver"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Drink choice
                  </span>
                  <select
                    name="drinkChoice"
                    required
                    value={drinkChoice}
                    onChange={(e) => setDrinkChoice(e.target.value)}
                    className={inputClassName}
                  >
                    <option value="">Select drink</option>
                    {FACILITY_DRINK_CHOICES.map((choice) => (
                      <option key={choice} value={choice}>
                        {choice}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    How will you pay?
                  </span>
                  <select
                    name="paymentMethod"
                    required
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className={inputClassName}
                  >
                    <option value="">Select payment method</option>
                    {PAYMENT_METHOD_CHOICES.map((choice) => (
                      <option key={choice} value={choice}>
                        {choice}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex gap-3 rounded-xl border border-white/10 bg-[#071326]/45 px-3 py-3 text-sm leading-relaxed text-slate-300">
                  <input
                    type="checkbox"
                    name="depositAcknowledged"
                    checked={depositAcknowledged}
                    onChange={(e) => setDepositAcknowledged(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-cyan-400"
                  />
                  <span>
                    I understand the $50 deposit is due within one week of
                    making this reservation and can be paid directly to Jumping
                    Jax.
                  </span>
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

              <div className="space-y-4 border-t border-white/10 pt-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-cyan-200">
                    Optional Add-ons
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Add-ons are optional and do not affect available time slots.
                  </p>
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-[#071326]/40 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={balloonsSelected}
                    onChange={(e) => setBalloonsSelected(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-cyan-400"
                  />
                  <span className="text-sm text-slate-200">
                    <span className="font-semibold text-white">
                      Custom Birthday Balloons
                    </span>
                    <span className="mt-0.5 block text-slate-400">$10</span>
                  </span>
                </label>

                <div className="rounded-xl border border-white/10 bg-[#071326]/40 px-3 py-3">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={goodieBagsSelected}
                      onChange={(e) => {
                        setGoodieBagsSelected(e.target.checked);
                        if (e.target.checked && goodieBagsQuantity < 1) {
                          setGoodieBagsQuantity(1);
                        }
                      }}
                      className="mt-1 h-4 w-4 shrink-0 accent-cyan-400"
                    />
                    <span className="text-sm text-slate-200">
                      <span className="font-semibold text-white">Goodie Bags</span>
                      <span className="mt-0.5 block text-slate-400">
                        $3.50 each
                      </span>
                    </span>
                  </label>
                  {goodieBagsSelected && (
                    <label className="mt-3 block pl-7">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Quantity
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={goodieBagsQuantity}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          setGoodieBagsQuantity(
                            Number.isFinite(next) && next >= 1 ? next : 1,
                          );
                        }}
                        className={inputClassName}
                      />
                    </label>
                  )}
                </div>

                <fieldset className="rounded-xl border border-white/10 bg-[#071326]/40 px-3 py-3">
                  <legend className="px-1 text-sm font-semibold text-white">
                    Cotton Candy Package
                  </legend>
                  <div className="mt-2 space-y-2">
                    {(
                      [
                        { id: "none" as const, label: "None", price: null },
                        {
                          id: "10_kids" as const,
                          label: "10 kids",
                          price: "$15",
                        },
                        {
                          id: "20_kids" as const,
                          label: "20 kids",
                          price: "$30",
                        },
                      ] as const
                    ).map((opt) => (
                      <label
                        key={opt.id}
                        className="flex cursor-pointer items-center gap-3 text-sm text-slate-200"
                      >
                        <input
                          type="radio"
                          name="cottonCandyPackage"
                          checked={cottonCandyPackage === opt.id}
                          onChange={() => setCottonCandyPackage(opt.id)}
                          className="h-4 w-4 shrink-0 accent-cyan-400"
                        />
                        <span>
                          {opt.label}
                          {opt.price ? (
                            <span className="text-slate-400"> — {opt.price}</span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {addonSubtotalPreview > 0 && (
                  <p className="text-sm font-semibold text-cyan-100">
                    Add-ons subtotal (estimate): ${addonSubtotalPreview.toFixed(2)}
                  </p>
                )}
                {pricingPreview && !pricingPreview.missingPrice && (
                  <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-3 text-sm text-slate-200">
                    {formatFacilityPricingLines(pricingPreview).map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                )}
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
