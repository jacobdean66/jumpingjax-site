"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { queryRentalUnavailableYmds } from "@/lib/supabase/booking-queries";
import {
  useBookingStore,
  type RentalCartItem,
} from "@/store/bookingStore";
import {
  FOAM_DURATION_OPTIONS,
  MOCK_DURATION_OPTIONS,
  ONE_DAY_RENTAL_DURATION,
  enumerateRange,
  formatDisplayDate,
  rangeHasBlocked,
} from "@/lib/mockBooking";
import {
  estimateCartGrandTotal,
  estimateCartRentalSubtotal,
  estimateMileageFee,
  estimateRentalDeliveryFee,
  isFoamPartyRentalItem,
  normalizeDistanceMiles,
} from "@/lib/rentals/rental-pricing-text";
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
  distanceMiles: "",
  setupSurface: "",
  setupAccess: "",
  setupNotes: "",
  paymentMethod: "",
};

const STANDARD_DELIVERY_WINDOWS = [
  "7:00 AM - 10:00 AM",
  "10:00 AM - 1:00 PM",
  "1:00 PM - 4:00 PM",
  "4:00 PM - 7:00 PM",
] as const;

const FRIDAY_DELIVERY_WINDOWS = [
  "Friday 7:00 AM - 10:00 AM",
  "Friday 10:00 AM - 1:00 PM",
  "Friday 1:00 PM - 4:00 PM",
  "Friday 4:00 PM - 7:00 PM",
] as const;

const PARTY_START_TIMES = [
  ["08:00", "8:00 AM"],
  ["08:30", "8:30 AM"],
  ["09:00", "9:00 AM"],
  ["09:30", "9:30 AM"],
  ["10:00", "10:00 AM"],
  ["10:30", "10:30 AM"],
  ["11:00", "11:00 AM"],
  ["11:30", "11:30 AM"],
  ["12:00", "12:00 PM"],
  ["12:30", "12:30 PM"],
  ["13:00", "1:00 PM"],
  ["13:30", "1:30 PM"],
  ["14:00", "2:00 PM"],
  ["14:30", "2:30 PM"],
  ["15:00", "3:00 PM"],
  ["15:30", "3:30 PM"],
  ["16:00", "4:00 PM"],
  ["16:30", "4:30 PM"],
  ["17:00", "5:00 PM"],
  ["17:30", "5:30 PM"],
  ["18:00", "6:00 PM"],
  ["18:30", "6:30 PM"],
  ["19:00", "7:00 PM"],
  ["19:30", "7:30 PM"],
  ["20:00", "8:00 PM"],
] as const;

function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function isFridayOrSaturday(ymd: string | null): boolean {
  if (!ymd) return false;
  const [year, month, day] = ymd.split("-").map(Number);
  if (!year || !month || !day) return false;
  const dayOfWeek = new Date(year, month - 1, day).getDay();
  return dayOfWeek === 5 || dayOfWeek === 6;
}

const RENTAL_SUCCESS_STORAGE_KEY = "jumpingjax-rental-booking-success-id";

type PersistedSubmitSuccess = {
  id: string;
  slug: string;
};

function readPersistedSubmitSuccess(slug: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(RENTAL_SUCCESS_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "id" in parsed &&
      "slug" in parsed &&
      typeof (parsed as PersistedSubmitSuccess).id === "string" &&
      typeof (parsed as PersistedSubmitSuccess).slug === "string" &&
      (parsed as PersistedSubmitSuccess).slug === slug
    ) {
      return (parsed as PersistedSubmitSuccess).id;
    }
    sessionStorage.removeItem(RENTAL_SUCCESS_STORAGE_KEY);
    return null;
  } catch {
    sessionStorage.removeItem(RENTAL_SUCCESS_STORAGE_KEY);
    return null;
  }
}

function writePersistedSubmitSuccess(id: string, slug: string): void {
  const payload: PersistedSubmitSuccess = { id, slug };
  sessionStorage.setItem(RENTAL_SUCCESS_STORAGE_KEY, JSON.stringify(payload));
}

function clearPersistedSubmitSuccess(): void {
  sessionStorage.removeItem(RENTAL_SUCCESS_STORAGE_KEY);
}

function parseBookingId(data: unknown): string | null {
  if (!data || typeof data !== "object" || !("id" in data)) {
    return null;
  }
  const rawId = (data as { id: unknown }).id;
  if (typeof rawId === "string" && rawId.trim()) {
    return rawId.trim();
  }
  if (typeof rawId === "number" && Number.isFinite(rawId)) {
    return String(rawId);
  }
  return null;
}

type RentalAddToRequestButtonProps = {
  rental_item: string;
  rental_name: string;
  variant?: "hero" | "compact";
  keepShoppingHref?: string;
};

const viewCartClassName = {
  hero: "inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-cyan-400 px-6 py-3 text-center text-base font-bold text-black transition hover:bg-cyan-300 active:scale-[0.98] sm:min-h-14 sm:text-lg",
  compact:
    "inline-flex min-h-11 w-full items-center justify-center rounded-full bg-cyan-400 px-4 py-2.5 text-center text-sm font-bold text-black transition hover:bg-cyan-300 active:scale-[0.98]",
} as const;

const keepShoppingClassName = {
  hero: "inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-white/25 bg-white/5 px-6 py-3 text-center text-base font-bold text-white transition hover:bg-white/10 active:scale-[0.98] sm:min-h-14 sm:text-lg",
  compact:
    "inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/25 bg-white/5 px-4 py-2.5 text-center text-sm font-bold text-white transition hover:bg-white/10 active:scale-[0.98]",
} as const;

export function RentalAddToRequestButton({
  rental_item,
  rental_name,
  variant = "hero",
  keepShoppingHref = "/rentals",
}: RentalAddToRequestButtonProps) {
  const addRentalToCart = useBookingStore((s) => s.addRentalToCart);
  const inCart = useBookingStore((s) =>
    s.rentalCartItems.some((item) => item.rental_item === rental_item),
  );

  const addClassName =
    variant === "compact"
      ? "inline-flex min-h-11 w-full items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-400/10 px-4 py-2.5 text-center text-sm font-bold text-cyan-100 transition hover:bg-cyan-400/20 active:scale-[0.98]"
      : "inline-flex min-h-14 w-full items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-400/10 px-6 py-4 text-center text-lg font-bold text-cyan-100 transition hover:bg-cyan-400/20 active:scale-[0.98] sm:text-xl";

  if (inCart) {
    return (
      <div
        className={
          variant === "compact"
            ? "w-full space-y-2"
            : "w-full space-y-3 sm:flex-1"
        }
        aria-live="polite"
      >
        <p
          className={
            variant === "compact"
              ? "text-center text-sm font-bold text-emerald-300"
              : "text-center text-base font-bold text-emerald-300 sm:text-lg"
          }
        >
          Added to cart
        </p>
        <div
          className={
            variant === "compact"
              ? "flex flex-col gap-2"
              : "flex flex-col gap-3 sm:flex-row"
          }
        >
          <Link href={keepShoppingHref} className={keepShoppingClassName[variant]}>
            Keep shopping
          </Link>
          <a href="#book-rental" className={viewCartClassName[variant]}>
            {variant === "compact" ? "View cart" : "View cart / checkout"}
          </a>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => addRentalToCart({ rental_item, rental_name })}
      className={addClassName}
    >
      Add to cart
    </button>
  );
}

export function RentalGoToBookingRequestButton({
  variant = "hero",
  ensureInCart,
}: {
  variant?: "hero" | "compact";
  ensureInCart?: Pick<RentalCartItem, "rental_item" | "rental_name">;
}) {
  const addRentalToCart = useBookingStore((s) => s.addRentalToCart);

  return (
    <a
      href="#book-rental"
      className={viewCartClassName[variant]}
      onClick={() => {
        if (ensureInCart) {
          addRentalToCart(ensureInCart);
        }
      }}
    >
      {variant === "compact" ? "View cart" : "View cart / checkout"}
    </a>
  );
}

export function RentalCartButton({ className }: { className?: string }) {
  const count = useBookingStore((s) => s.rentalCartItems.length);

  return (
    <a
      href="#book-rental"
      className={
        className ??
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-400/15 px-5 py-2.5 text-sm font-bold text-cyan-50 shadow-sm transition hover:bg-cyan-400/25 active:scale-[0.98] sm:text-base"
      }
      aria-label={`Rental cart, ${count} item${count === 1 ? "" : "s"}`}
    >
      Rental Cart ({count})
    </a>
  );
}

export function RentalCartStatus() {
  return <RentalCartButton />;
}

type RentalCardCartActionsProps = {
  rental_item: string;
  rental_name: string;
  keepShoppingHref?: string;
};

export function RentalCardCartActions({
  rental_item,
  rental_name,
  keepShoppingHref = "/rentals",
}: RentalCardCartActionsProps) {
  const inCart = useBookingStore((s) =>
    s.rentalCartItems.some((item) => item.rental_item === rental_item),
  );

  return (
    <div className="mt-3 flex flex-col gap-2">
      <RentalAddToRequestButton
        rental_item={rental_item}
        rental_name={rental_name}
        variant="compact"
        keepShoppingHref={keepShoppingHref}
      />
      {!inCart && <RentalGoToBookingRequestButton variant="compact" />}
    </div>
  );
}

export function RentalBookingPanel({
  rental_item: slug,
  rentalTitle,
  initialUnavailableYmds,
  availabilityLoadError,
}: RentalBookingPanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitIdempotencyKey = useRef<string | null>(null);

  const [selectedYmd, setSelectedYmd] = useState<string | null>(null);
  const [clickedBlockedYmd, setClickedBlockedYmd] = useState<string | null>(null);
  const [durationId, setDurationId] = useState(ONE_DAY_RENTAL_DURATION.id);
  const [customer, setCustomer] = useState<CustomerFields>(emptyCustomer);
  const [deliveryTime, setDeliveryTime] = useState("");
  const [eventStartTime, setEventStartTime] = useState("");

  const rentalCartItems = useBookingStore((s) => s.rentalCartItems);
  const removeRentalFromCart = useBookingStore((s) => s.removeRentalFromCart);

  const [optimisticBlockedYmds, setOptimisticBlockedYmds] = useState(
    () => new Set<string>(),
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [restoredSuccessId, setRestoredSuccessId] = useState<string | null>(null);
  const [submitEmailsSent, setSubmitEmailsSent] = useState<boolean | null>(null);

  const clearSubmitSuccess = () => {
    clearPersistedSubmitSuccess();
    setSuccessId(null);
    setRestoredSuccessId(null);
    setSubmitEmailsSent(null);
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setRestoredSuccessId(readPersistedSubmitSuccess(slug));
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [slug]);

  const activeSuccessId = successId ?? restoredSuccessId;

  const skipCartSuccessClear = useRef(true);
  useEffect(() => {
    if (skipCartSuccessClear.current) {
      skipCartSuccessClear.current = false;
      return;
    }
    clearSubmitSuccess();
  }, [rentalCartItems]);

  const selectedRentalItems = useMemo((): RentalCartItem[] => {
    if (rentalCartItems.length === 0) {
      return [{ rental_item: slug, rental_name: rentalTitle }];
    }
    if (rentalCartItems.some((item) => item.rental_item === slug)) {
      return rentalCartItems;
    }
    return [
      { rental_item: slug, rental_name: rentalTitle },
      ...rentalCartItems,
    ];
  }, [rentalCartItems, slug, rentalTitle]);

  const isFoamOnlyCart = selectedRentalItems.every((item) =>
    isFoamPartyRentalItem(item.rental_item),
  );
  const durationOptions = isFoamOnlyCart
    ? FOAM_DURATION_OPTIONS
    : MOCK_DURATION_OPTIONS;

  const selectedDurationId = durationOptions.some(
    (option) => option.id === durationId,
  )
    ? durationId
    : durationOptions[0]!.id;

  const displayCartItems = useMemo((): RentalCartItem[] => {
    if (rentalCartItems.length > 0) {
      return rentalCartItems;
    }
    return [{ rental_item: slug, rental_name: rentalTitle }];
  }, [rentalCartItems, slug, rentalTitle]);

  const currentPageIncludedAtSubmit =
    rentalCartItems.length > 0 &&
    !rentalCartItems.some((item) => item.rental_item === slug);
  const showFridayDeliveryPrompt = isFridayOrSaturday(selectedYmd);
  const selectedDeliveryTime =
    !showFridayDeliveryPrompt && deliveryTime.startsWith("Friday ")
      ? ""
      : deliveryTime;

  type ClientFetchState =
    | { status: "idle" }
    | { status: "skipped" }
    | { status: "pending" }
    | {
        status: "ok";
        ymds: string[];
        unavailableByRentalItem: Record<string, string[]>;
      }
    | { status: "error" };

  const [clientFetch, setClientFetch] = useState<ClientFetchState>({
    status: "pending",
  });
  const [fetchSlug, setFetchSlug] = useState(slug);
  if (!activeSuccessId && slug !== fetchSlug) {
    setFetchSlug(slug);
    setClientFetch({ status: "pending" });
  }

  useEffect(() => {
    let cancelled = false;
    const rentalItemsToCheck = Array.from(
      new Set(
        selectedRentalItems
          .map((item) => item.rental_item.trim())
          .filter(Boolean),
      ),
    );

    void (async () => {
      try {
        const results = await Promise.all(
          rentalItemsToCheck.map((rentalItem) =>
            queryRentalUnavailableYmds(rentalItem, 6),
          ),
        );
        if (cancelled) return;
        if (results.every((result) => result.error === "not_configured")) {
          setClientFetch({ status: "skipped" });
        } else if (results.some((result) => result.error === "read_failed")) {
          setClientFetch({ status: "error" });
        } else {
          const unavailableByRentalItem = Object.fromEntries(
            rentalItemsToCheck.map((rentalItem, index) => [
              rentalItem,
              results[index]?.ymds ?? [],
            ]),
          );

          setClientFetch({
            status: "ok",
            ymds: [...new Set(results.flatMap((result) => result.ymds))].sort(),
            unavailableByRentalItem,
          });
        }
      } catch {
        if (!cancelled) setClientFetch({ status: "error" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedRentalItems]);

  const effectiveUnavailableYmds =
    clientFetch.status === "ok" ? clientFetch.ymds : initialUnavailableYmds;

  const blockedSet = useMemo(() => {
    const s = new Set(effectiveUnavailableYmds);
    optimisticBlockedYmds.forEach((d) => s.add(d));
    return s;
  }, [effectiveUnavailableYmds, optimisticBlockedYmds]);

  const duration = useMemo(
    () => durationOptions.find((d) => d.id === selectedDurationId),
    [durationOptions, selectedDurationId],
  );

  const selectionValid = useMemo(() => {
    if (!selectedYmd || !duration) return false;
    return !rangeHasBlocked(selectedYmd, duration.spanDays, blockedSet);
  }, [selectedYmd, duration, blockedSet]);

  const clickedBlockedUnavailableItems = useMemo(() => {
    if (!clickedBlockedYmd || clientFetch.status !== "ok") return [];

    return selectedRentalItems.filter((item) => {
      const unavailableYmds =
        clientFetch.unavailableByRentalItem[item.rental_item] ?? [];
      return unavailableYmds.includes(clickedBlockedYmd);
    });
  }, [clickedBlockedYmd, clientFetch, selectedRentalItems]);

  const selectionMessage = useMemo(() => {
    if (!selectedYmd) return "Pick a start date to see your estimate.";
    if (!duration) return undefined;
    if (!selectionValid) {
      return "That rental date is unavailable. Choose another date.";
    }
    return "Looks good — complete checkout below and submit your request.";
  }, [selectedYmd, duration, selectionValid]);

  const selectionMessageTone = useMemo((): "info" | "warn" | "ok" => {
    if (!selectedYmd) return "info";
    if (!selectionValid) return "warn";
    return "ok";
  }, [selectedYmd, selectionValid]);

  const customerOk = useMemo(() => {
    const phoneDigits = digitsOnly(customer.customerPhone);
    const verifiedDistanceMiles = normalizeDistanceMiles(customer.distanceMiles);
    return (
      customer.customerName.trim().length >= 2 &&
      isPlausibleEmail(customer.customerEmail) &&
      phoneDigits.length >= 10 &&
      customer.eventAddress.trim().length >= 8 &&
      verifiedDistanceMiles !== null &&
      customer.setupSurface.trim().length > 0 &&
      customer.setupAccess.trim().length > 0 &&
      customer.paymentMethod.trim().length > 0 &&
      selectedDeliveryTime.trim().length > 0 &&
      eventStartTime.trim().length > 0
    );
  }, [customer, selectedDeliveryTime, eventStartTime]);

  const distanceMiles = normalizeDistanceMiles(customer.distanceMiles);
  const deliveryFee = selectionValid && duration
    ? estimateRentalDeliveryFee(distanceMiles)
    : null;
  const mileageFee = selectionValid && duration
    ? estimateMileageFee(distanceMiles)
    : null;

  const subtotal =
    selectionValid && duration
      ? estimateCartRentalSubtotal(
          selectedRentalItems,
          duration.label,
          duration.spanDays,
        )
      : null;
  const totalAmount =
    selectionValid && duration
      ? estimateCartGrandTotal(
          selectedRentalItems,
          duration.label,
          duration.spanDays,
          deliveryFee ?? undefined,
        )
      : null;

  const totalDisplay =
    totalAmount !== null ? `$${totalAmount}` : null;

  const reserveReason = !selectionValid
    ? "Complete a valid rental date first."
      : selectedRentalItems.length === 0
        ? "Add at least one rental to your request."
      : !customerOk
        ? "Add your contact details, verify the event address, choose setup details, choose payment method, choose a delivery window, and add the party start time to continue."
        : undefined;

  const submitBlocked = Boolean(reserveReason) || isSubmitting;

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

    const customer_name = customer.customerName;
    const customer_phone = customer.customerPhone;
    const customer_email = customer.customerEmail;
    const event_date = selectedYmd ?? "";

    setSubmitError(null);
    clearSubmitSuccess();

    if (reserveReason) {
      setSubmitError(reserveReason);
      document
        .getElementById("checkout-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    setIsSubmitting(true);
    submitIdempotencyKey.current ??= crypto.randomUUID();

    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idempotency_key: submitIdempotencyKey.current,
          customer_name,
          customer_phone,
          customer_email,
          event_date,
          rental_item: slug,
          rental_items: selectedRentalItems,
          event_address: customer.eventAddress,
          requested_delivery_window: selectedDeliveryTime,
          event_start_time: eventStartTime,
          distance_miles: distanceMiles,
          delivery_fee: deliveryFee ?? 0,
          mileage_fee: mileageFee ?? 0,
          setup_surface: customer.setupSurface,
          setup_access: customer.setupAccess,
          setup_notes: customer.setupNotes,
          payment_method: customer.paymentMethod,
          duration: duration?.label ?? "",
          span_days: duration?.spanDays ?? 1,
          subtotal: subtotal ?? 0,
          total: totalAmount ?? 0,
        }),
      });

      const data: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        const apiError =
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : `Request failed (${res.status})`;
        setSubmitError(apiError);
        document
          .getElementById("book-rental")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      const id = parseBookingId(data);
      const emailsSent =
        data != null &&
        typeof data === "object" &&
        "emailsSent" in data &&
        (data as { emailsSent?: unknown }).emailsSent === true;
      const message =
        data &&
        typeof data === "object" &&
        "message" in data &&
        typeof (data as { message?: unknown }).message === "string"
          ? (data as { message: string }).message
          : undefined;

      if (res.ok && id) {
        setSubmitEmailsSent(emailsSent);
        writePersistedSubmitSuccess(id, slug);
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
        document
          .getElementById("book-rental")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  if (activeSuccessId) {
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
            {submitEmailsSent === false && (
              <p className="mt-3 rounded-xl border border-amber-400/35 bg-amber-400/10 px-4 py-3 text-sm leading-relaxed text-amber-100">
                Your request was saved, but we could not send a confirmation
                email from the server. Jumping Jax will still follow up using
                the phone number and email you provided.
              </p>
            )}
            <p className="mt-3 text-sm leading-relaxed text-slate-200">
              Booking request ID:{" "}
              <span className="font-mono text-xs text-white">
                {activeSuccessId}
              </span>
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <form id="booking-form" onSubmit={handleSubmit} noValidate>
      <fieldset disabled={isSubmitting} className="min-w-0 border-0 p-0">
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
              Rental Cart
            </h2>
            <p className="mt-1 text-base font-bold text-white sm:text-lg">
              Checkout request
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
              Review your cart, then complete the checkout form below to send
              one request for everything. Unavailable days reflect pending,
              approved, and blocked bookings in our system.
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

            <div className="mt-6 rounded-2xl border-2 border-cyan-400/35 bg-cyan-400/10 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-black uppercase tracking-wide text-cyan-100">
                  Your cart
                </h3>
                <span className="rounded-full border border-cyan-300/40 bg-cyan-300/15 px-2.5 py-0.5 text-xs font-bold tabular-nums text-cyan-50">
                  {displayCartItems.length}
                </span>
              </div>
              <ul
                className="mt-3 space-y-2"
                aria-label="Cart items"
              >
                {displayCartItems.map((item) => {
                  const isFallback =
                    rentalCartItems.length === 0 &&
                    item.rental_item === slug;

                  return (
                    <li
                      key={item.rental_item}
                      className="flex items-center justify-between gap-3 rounded-lg border border-white/15 bg-[#071326]/50 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-white">
                          {item.rental_name}
                        </span>
                        {isFallback && (
                          <span className="mt-0.5 block text-xs text-cyan-100/70">
                            On this page — add to cart or checkout below
                          </span>
                        )}
                      </div>
                      {!isFallback && (
                        <button
                          type="button"
                          onClick={() =>
                            removeRentalFromCart(item.rental_item)
                          }
                          className="shrink-0 text-xs font-bold uppercase tracking-wider text-rose-300 hover:text-rose-200"
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              {currentPageIncludedAtSubmit && (
                <p className="mt-3 text-xs leading-relaxed text-cyan-100/80">
                  <span className="font-semibold text-cyan-50">
                    {rentalTitle}
                  </span>{" "}
                  (this page) will also be included when you submit.
                </p>
              )}
              <p className="mt-3 text-xs leading-relaxed text-cyan-100/80">
                Add more with{" "}
                <a
                  href="#related-rentals"
                  className="font-semibold text-cyan-50 underline decoration-cyan-200/50 underline-offset-2 hover:text-white"
                >
                  related rentals below
                </a>{" "}
                or browse other units, then return here to checkout.
              </p>
            </div>

            <div
              id="checkout-form"
              className="mt-8 grid scroll-mt-28 gap-6 sm:scroll-mt-32 lg:grid-cols-2 lg:items-start"
            >
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    1. Date
                  </h3>
                  <div className="mt-3">
                    <BookingDateCalendar
                      value={selectedYmd}
                      onChange={(ymd) => {
                        setClickedBlockedYmd(null);
                        setSelectedYmd(ymd);
                      }}
                      blocked={blockedSet}
                      onBlockedDateClick={(ymd) => {
                        setSelectedYmd(null);
                        setClickedBlockedYmd(ymd);
                      }}
                      blockedPopoverYmd={
                        clickedBlockedUnavailableItems.length > 0
                          ? clickedBlockedYmd
                          : null
                      }
                      renderBlockedPopover={(ymd) => {
                        if (clickedBlockedUnavailableItems.length === 0) {
                          return null;
                        }
                        return (
                          <>
                            <p className="font-semibold text-amber-50">
                              {clickedBlockedUnavailableItems.length === 1
                                ? `${clickedBlockedUnavailableItems[0]!.rental_name} is unavailable on ${formatDisplayDate(ymd)}.`
                                : `Unavailable on ${formatDisplayDate(ymd)}:`}
                            </p>
                            {clickedBlockedUnavailableItems.length > 1 && (
                              <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                                {clickedBlockedUnavailableItems.map((item) => (
                                  <li key={item.rental_item}>
                                    {item.rental_name}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </>
                        );
                      }}
                    />
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    2. {isFoamOnlyCart ? "Foam time" : "Rental duration"}
                  </h3>
                  <div className="mt-3">
                    {isFoamOnlyCart ? (
                      <DurationSelector
                        options={durationOptions}
                        value={selectedDurationId}
                        onChange={setDurationId}
                      />
                    ) : (
                      <p className="rounded-2xl border border-cyan-300/40 bg-cyan-400/10 px-4 py-4 text-sm font-bold text-cyan-50">
                        Rental duration: {ONE_DAY_RENTAL_DURATION.label}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <BookingSummary
                  cartItems={selectedRentalItems}
                  selectedYmd={selectedYmd}
                  duration={duration}
                  selectionValid={selectionValid}
                  selectionMessage={selectionMessage}
                  selectionMessageTone={selectionMessageTone}
                  distanceMiles={customer.distanceMiles}
                />
                <CustomerForm value={customer} onChange={setCustomer} />
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
                  <label className="mb-5 block">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Official party start time
                    </span>
                    <select
                      name="eventStartTime"
                      required
                      value={eventStartTime}
                      onChange={(e) => setEventStartTime(e.target.value)}
                      className="mt-1.5 w-full appearance-none rounded-xl border border-white/15 bg-[#071326]/80 px-3 py-3 text-base text-white outline-none ring-cyan-400/0 transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/30"
                    >
                      <option value="">Select official start time</option>
                      {PARTY_START_TIMES.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">
                      This is when your party officially starts. It is separate
                      from the delivery window and will appear on the booking
                      details.
                    </p>
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Requested delivery window
                    </span>
                    <select
                      name="deliveryTime"
                      required
                      value={selectedDeliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                      className="mt-1.5 w-full appearance-none rounded-xl border border-white/15 bg-[#071326]/80 px-3 py-3 text-base text-white outline-none ring-cyan-400/0 transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/30"
                    >
                      <option value="">Select a 3-hour delivery window</option>
                      {showFridayDeliveryPrompt && (
                        <optgroup label="Friday delivery recommended">
                          {FRIDAY_DELIVERY_WINDOWS.map((window) => (
                            <option key={window} value={window}>
                              {window} (recommended)
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Standard delivery windows">
                        {STANDARD_DELIVERY_WINDOWS.map((window) => (
                          <option key={window} value={window}>
                            {window}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    {showFridayDeliveryPrompt && (
                      <p className="mt-2 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
                        Friday delivery is recommended for Friday and Saturday
                        events when available. It helps us route weekend
                        deliveries and gives setup more breathing room.
                      </p>
                    )}
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">
                      This is a requested delivery window. Jumping Jax will
                      confirm the final delivery plan after reviewing the route.
                    </p>
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-400 sm:max-w-xs">
                Complete the checkout form above, then submit your request.
              </p>
              <button
                type="submit"
                disabled={submitBlocked}
                className="inline-flex min-h-12 w-full shrink-0 items-center justify-center rounded-full bg-cyan-400 px-8 py-3 text-sm font-black text-black shadow-lg shadow-cyan-950/25 transition hover:bg-cyan-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-h-14 sm:text-base"
              >
                {isSubmitting ? "Sending…" : "Submit request"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <StickyReserveBar
        totalDisplay={totalDisplay}
        disabledReason={reserveReason}
        submitDisabled={submitBlocked}
      />
      </fieldset>
    </form>
  );
}
