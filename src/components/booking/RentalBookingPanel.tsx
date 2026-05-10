"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { submitRentalBookingRequest } from "@/app/actions/rental-booking";
import {
  MOCK_DURATION_OPTIONS,
  estimateGrandTotal,
  estimateRentalSubtotal,
  enumerateRange,
  rangeHasBlocked,
} from "@/lib/mockBooking";
import { BookingDateCalendar } from "./BookingDateCalendar";
import { BookingSummary } from "./BookingSummary";
import { CustomerForm, type CustomerFields } from "./CustomerForm";
import { DurationSelector } from "./DurationSelector";
import { StickyReserveBar } from "./StickyReserveBar";

export type RentalBookingPanelProps = {
  rentalSlug: string;
  rentalTitle: string;
  startingPrice: number;
  initialUnavailableYmds: string[];
  availabilityLoadError: "not_configured" | "read_failed" | null;
};

const emptyCustomer: CustomerFields = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  eventAddress: "",
};

function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

export function RentalBookingPanel({
  rentalSlug,
  rentalTitle,
  startingPrice,
  initialUnavailableYmds,
  availabilityLoadError,
}: RentalBookingPanelProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);
  const [durationId, setDurationId] = useState(MOCK_DURATION_OPTIONS[1]!.id);
  const [customer, setCustomer] = useState<CustomerFields>(emptyCustomer);

  const [optimisticBlockedYmds, setOptimisticBlockedYmds] = useState(
    () => new Set<string>(),
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const blockedSet = useMemo(() => {
    const s = new Set(initialUnavailableYmds);
    optimisticBlockedYmds.forEach((d) => s.add(d));
    return s;
  }, [initialUnavailableYmds, optimisticBlockedYmds]);

  const duration = useMemo(
    () => MOCK_DURATION_OPTIONS.find((d) => d.id === durationId),
    [durationId],
  );

  const selectionValid = useMemo(() => {
    if (!selectedYmd || !duration) return false;
    return !rangeHasBlocked(selectedYmd, duration.spanDays, blockedSet);
  }, [selectedYmd, duration, blockedSet]);

  const selectionMessage = useMemo(() => {
    if (!selectedYmd) return "Pick a start date to see your estimate.";
    if (!duration) return undefined;
    if (!selectionValid) {
      return "That duration overlaps an unavailable date. Choose another start date or shorter duration.";
    }
    return "Looks good — review your details and tap Reserve when ready.";
  }, [selectedYmd, duration, selectionValid]);

  const selectionMessageTone = useMemo((): "info" | "warn" | "ok" => {
    if (!selectedYmd) return "info";
    if (!selectionValid) return "warn";
    return "ok";
  }, [selectedYmd, selectionValid]);

  const customerOk = useMemo(() => {
    const phoneDigits = digitsOnly(customer.customerPhone);
    return (
      customer.customerName.trim().length >= 2 &&
      isPlausibleEmail(customer.customerEmail) &&
      phoneDigits.length >= 10 &&
      customer.eventAddress.trim().length >= 8
    );
  }, [customer]);

  const subtotal =
    selectionValid && duration
      ? estimateRentalSubtotal(startingPrice, duration.priceMultiplier)
      : null;
  const totalAmount =
    selectionValid && duration
      ? estimateGrandTotal(startingPrice, duration.priceMultiplier)
      : null;

  const totalDisplay =
    totalAmount !== null ? `$${totalAmount}` : null;

  const reserveDisabled =
    !!successId || !selectionValid || !customerOk || isSubmitting;

  const reserveReason = successId
    ? undefined
    : reserveDisabled && !isSubmitting
      ? !selectionValid
        ? "Complete a valid date and duration first."
        : "Add your name, email, phone, and event address to continue."
      : undefined;

  const availabilityBanner = useMemo(() => {
    if (availabilityLoadError === "not_configured") {
      return {
        tone: "warn" as const,
        text: "Live availability is not connected yet (missing Supabase environment variables). All dates appear open until this is configured.",
      };
    }
    if (availabilityLoadError === "read_failed") {
      return {
        tone: "warn" as const,
        text: "We could not load live holds from the server. Try refreshing the page. To avoid double-booking, confirm dates with Jumping Jax before paying.",
      };
    }
    return null;
  }, [availabilityLoadError]);

  const handleReserve = async () => {
    if (reserveDisabled || !selectedYmd || !duration) return;
    if (subtotal === null || totalAmount === null) return;

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const result = await submitRentalBookingRequest({
        rentalSlug,
        rentalName: rentalTitle,
        customerName: customer.customerName.trim(),
        email: customer.customerEmail.trim(),
        phone: customer.customerPhone.trim(),
        eventDateYmd: selectedYmd,
        durationLabel: duration.label,
        spanDays: duration.spanDays,
        eventAddress: customer.eventAddress.trim(),
        subtotal,
        total: totalAmount,
      });

      if (result.ok) {
        setSuccessId(result.id);
        setOptimisticBlockedYmds((prev) => {
          const next = new Set(prev);
          for (const d of enumerateRange(selectedYmd, duration.spanDays)) {
            next.add(d);
          }
          return next;
        });
        router.refresh();
        return;
      }

      if (result.code === "conflict") {
        setSubmitError(
          "Those dates are no longer available. Please pick another start date or duration.",
        );
        router.refresh();
        return;
      }

      if (result.code === "not_configured") {
        setSubmitError(
          "Booking cannot be saved right now — server configuration is incomplete.",
        );
        return;
      }

      setSubmitError("We could not save your request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <section
        id="book-rental"
        className="scroll-mt-28 pb-24 sm:scroll-mt-32 sm:pb-28"
        aria-labelledby="book-rental-heading"
      >
        <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 via-transparent to-transparent p-1">
          <div className="rounded-[0.9rem] border border-white/10 bg-[#071326]/60 p-5 sm:p-7">
            <h2
              id="book-rental-heading"
              className="text-sm font-black uppercase tracking-[0.12em] text-cyan-200"
            >
              Reserve this rental
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
              Choose dates, duration, and your contact info. Unavailable days
              reflect pending, approved, and blocked bookings in our system.
              Estimated totals use mock delivery pricing for now.
            </p>

            {availabilityBanner && (
              <p
                className={
                  availabilityBanner.tone === "warn"
                    ? "mt-4 rounded-xl border border-amber-400/35 bg-amber-400/10 px-4 py-3 text-xs leading-relaxed text-amber-100 sm:text-sm"
                    : "mt-4 text-xs text-slate-400"
                }
                role="status"
              >
                {availabilityBanner.text}
              </p>
            )}

            {successId && (
              <div
                className="mt-4 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-3 text-sm leading-relaxed text-cyan-50"
                role="status"
              >
                <p className="font-bold text-cyan-200">Request received</p>
                <p className="mt-1 text-slate-200">
                  Your booking is pending review. Reference ID:{" "}
                  <span className="font-mono text-xs text-white">{successId}</span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSuccessId(null);
                    setSelectedYmd(null);
                    setCustomer(emptyCustomer);
                    setSubmitError(null);
                    setOptimisticBlockedYmds(new Set());
                  }}
                  className="mt-3 text-xs font-black uppercase tracking-wider text-cyan-300 underline-offset-4 hover:text-cyan-200 hover:underline"
                >
                  Book another date
                </button>
              </div>
            )}

            {submitError && (
              <p
                className="mt-4 rounded-xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
                role="alert"
              >
                {submitError}
              </p>
            )}

            <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    1. Date
                  </h3>
                  <div className="mt-3">
                    <BookingDateCalendar
                      value={selectedYmd}
                      onChange={setSelectedYmd}
                      blocked={blockedSet}
                    />
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    2. Duration
                  </h3>
                  <div className="mt-3">
                    <DurationSelector
                      options={MOCK_DURATION_OPTIONS}
                      value={durationId}
                      onChange={setDurationId}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <BookingSummary
                  rentalTitle={rentalTitle}
                  startingPrice={startingPrice}
                  selectedYmd={selectedYmd}
                  duration={duration}
                  selectionValid={selectionValid}
                  selectionMessage={selectionMessage}
                  selectionMessageTone={selectionMessageTone}
                />
                <CustomerForm value={customer} onChange={setCustomer} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <StickyReserveBar
        totalDisplay={totalDisplay}
        disabled={reserveDisabled}
        disabledReason={reserveReason}
        onReserve={handleReserve}
        isSubmitting={isSubmitting}
      />
    </>
  );
}
