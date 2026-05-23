"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { queryRentalUnavailableYmds } from "@/lib/supabase/booking-queries";
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
  rental_item: string;
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
  rental_item: slug,
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
  const [deliveryTime, setDeliveryTime] = useState("");

  const [optimisticBlockedYmds, setOptimisticBlockedYmds] = useState(
    () => new Set<string>(),
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  type ClientFetchState =
    | { status: "idle" }
    | { status: "skipped" }
    | { status: "pending" }
    | { status: "ok"; ymds: string[] }
    | { status: "error" };

  const [clientFetch, setClientFetch] = useState<ClientFetchState>({
    status: "pending",
  });
  const [fetchSlug, setFetchSlug] = useState(slug);
  if (slug !== fetchSlug) {
    setFetchSlug(slug);
    setClientFetch({ status: "pending" });
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { ymds, error } = await queryRentalUnavailableYmds(
          slug,
          6,
        );
        if (cancelled) return;
        if (error === "not_configured") setClientFetch({ status: "skipped" });
        else if (error) setClientFetch({ status: "error" });
        else setClientFetch({ status: "ok", ymds });
      } catch {
        if (!cancelled) setClientFetch({ status: "error" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const effectiveUnavailableYmds =
    clientFetch.status === "ok" ? clientFetch.ymds : initialUnavailableYmds;

  const blockedSet = useMemo(() => {
    const s = new Set(effectiveUnavailableYmds);
    optimisticBlockedYmds.forEach((d) => s.add(d));
    return s;
  }, [effectiveUnavailableYmds, optimisticBlockedYmds]);

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
      customer.eventAddress.trim().length >= 8 &&
      deliveryTime.trim().length > 0
    );
  }, [customer, deliveryTime]);

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

  const reserveReason = !selectionValid
    ? "Complete a valid date and duration first."
    : !customerOk
      ? "Add your name, email, phone, event address, and requested delivery time to continue."
      : undefined;

  const serverLoadOk = availabilityLoadError === null;

  const availabilityBanner = useMemo(() => {
    if (clientFetch.status === "ok") {
      return null;
    }

    if (clientFetch.status === "skipped") {
      return {
        tone: "warn" as const,
        text: "Live availability is not connected yet (missing Supabase environment variables). All dates appear open until this is configured.",
      };
    }

    if (clientFetch.status === "pending") {
      if (availabilityLoadError === "read_failed") {
        return {
          tone: "warn" as const,
          text: "We could not load live holds from the server. Try refreshing the page. To avoid double-booking, confirm dates with Jumping Jax before paying.",
        };
      }
      return null;
    }

    if (clientFetch.status === "error") {
      if (!serverLoadOk || availabilityLoadError === "read_failed") {
        return {
          tone: "warn" as const,
          text: "We could not load live holds from the server. Try refreshing the page. To avoid double-booking, confirm dates with Jumping Jax before paying.",
        };
      }
      return null;
    }

    return null;
  }, [availabilityLoadError, clientFetch.status, serverLoadOk]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("Submitting booking");

    const customer_name = customer.customerName;
    const customer_phone = customer.customerPhone;
    const customer_email = customer.customerEmail;
    const event_date = selectedYmd ?? "";

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_name,
          customer_phone,
          customer_email,
          event_date,
          rental_item: slug,
          event_address: customer.eventAddress,
          delivery_time: deliveryTime,
          duration: duration?.label ?? "",
          span_days: duration?.spanDays ?? 1,
          subtotal: subtotal ?? 0,
          total: totalAmount ?? 0,
        }),
      });

      const data: unknown = await res.json().catch(() => null);
      console.log("RENTAL BOOK RESPONSE", {
        status: res.status,
        ok: res.ok,
        data,
      });
      console.log("Booking response", { status: res.status, ok: res.ok, data });

      if (!res.ok) {
        const apiError =
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : `Request failed (${res.status})`;
        setSubmitError(apiError);
        return;
      }

      const ok =
        res.ok &&
        data &&
        typeof data === "object" &&
        "ok" in data &&
        (data as { ok?: boolean }).ok === true;
      const rawId =
        data && typeof data === "object" && "id" in data
          ? (data as { id: unknown }).id
          : null;
      const id =
        typeof rawId === "string"
          ? rawId
          : typeof rawId === "number"
            ? String(rawId)
            : null;
      const message =
        data &&
        typeof data === "object" &&
        "message" in data &&
        typeof (data as { message?: unknown }).message === "string"
          ? (data as { message: string }).message
          : undefined;

      if (ok && id) {
        setSuccessId(id);
        if (selectedYmd && duration) {
          setOptimisticBlockedYmds((prev) => {
            const next = new Set(prev);
            for (const d of enumerateRange(selectedYmd, duration.spanDays)) {
              next.add(d);
            }
            return next;
          });
        }
        router.refresh();
      } else {
        setSubmitError(
          message ?? "We could not save your request. Please try again.",
        );
      }
    } catch (err) {
      console.error("Booking failed", err);
      setSubmitError(
        err instanceof Error ? err.message : "Network error. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successId) {
    return (
      <section
        id="book-rental"
        className="scroll-mt-28 pb-24 sm:scroll-mt-32 sm:pb-28"
        aria-labelledby="book-rental-success-heading"
      >
        <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 via-transparent to-transparent p-1">
          <div
            className="rounded-[0.9rem] border border-white/10 bg-[#071326]/60 p-5 sm:p-7"
            role="status"
          >
            <h2
              id="book-rental-success-heading"
              className="text-sm font-black uppercase tracking-[0.12em] text-cyan-200"
            >
              Request submitted
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-200">
              Your rental request is pending approval.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-200">
              You will receive an email once Jumping Jax confirms your booking.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-200">
              Booking request ID:{" "}
              <span className="font-mono text-xs text-white">{successId}</span>
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <form id="booking-form" onSubmit={handleSubmit} noValidate>
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
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Requested delivery time
                    </span>
                    <input
                      type="time"
                      name="deliveryTime"
                      required
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#071326]/80 px-3 py-3 text-base text-white outline-none ring-cyan-400/0 transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/30"
                    />
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">
                      Please allow a 30-minute setup window before your event
                      start time.
                    </p>
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-400 sm:max-w-xs">
                Tap Reserve to send your request. You can use this button or the
                bar at the bottom of the screen.
              </p>
              <button
                type="submit"
                className="inline-flex min-h-12 w-full shrink-0 items-center justify-center rounded-full bg-cyan-400 px-8 py-3 text-sm font-black text-black shadow-lg shadow-cyan-950/25 transition hover:bg-cyan-300 active:scale-[0.98] sm:w-auto sm:min-h-14 sm:text-base"
              >
                {isSubmitting ? "Sending…" : "Reserve now"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <StickyReserveBar
        totalDisplay={totalDisplay}
        disabledReason={reserveReason}
      />
    </form>
  );
}
