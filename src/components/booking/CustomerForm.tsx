"use client";

import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";

import type { CheckoutErrors, RentalCheckoutStep } from "@/lib/rentals/checkout-validation";

export type CustomerFields = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  eventAddress: string;
  distanceMiles: string;
  setupSurface: string;
  setupAccess: string;
  setupNotes: string;
  paymentMethod: string;
};

type Props = {
  step: RentalCheckoutStep;
  errors: CheckoutErrors;
  value: CustomerFields;
  onChange: Dispatch<SetStateAction<CustomerFields>>;
};

type AddressDistanceResult = {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  distanceMiles: number;
  distanceText: string | null;
  durationText: string | null;
  originAddress: string;
};

export function CustomerForm({ value, onChange, step, errors }: Props) {
  const verificationId = useRef(0);
  const [addressResult, setAddressResult] =
    useState<AddressDistanceResult | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  const patch = (partial: Partial<CustomerFields>) =>
    onChange(previous => ({ ...previous, ...partial }));

  const mapSrc = useMemo(() => {
    if (!addressResult) return null;
    const query = encodeURIComponent(
      `${addressResult.latitude},${addressResult.longitude}`,
    );
    return `https://www.google.com/maps?q=${query}&z=15&output=embed`;
  }, [addressResult]);

  const routeUrl = useMemo(() => {
    if (!addressResult) return null;
    const origin = encodeURIComponent(addressResult.originAddress);
    const destination = encodeURIComponent(addressResult.formattedAddress);
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  }, [addressResult]);

  const verifyAddress = async () => {
    const currentVerification = ++verificationId.current;
    setAddressLoading(true);
    setAddressError(null);
    setAddressResult(null);

    try {
      const res = await fetch("/api/rentals/address-distance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: value.eventAddress }),
      });
      const data = (await res.json().catch(() => null)) as
        | (Partial<AddressDistanceResult> & { error?: string })
        | null;

      if (
        !res.ok ||
        !data?.formattedAddress ||
        typeof data.distanceMiles !== "number"
      ) {
        throw new Error(data?.error || "We could not verify that address.");
      }

      const nextResult: AddressDistanceResult = {
        formattedAddress: data.formattedAddress,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        distanceMiles: data.distanceMiles,
        distanceText: data.distanceText ?? null,
        durationText: data.durationText ?? null,
        originAddress: data.originAddress ?? "559 Beaudrot Rd, Greenwood, SC",
      };

      if (currentVerification !== verificationId.current) return;
      setAddressResult(nextResult);
      patch({
        eventAddress: nextResult.formattedAddress,
        distanceMiles: String(nextResult.distanceMiles),
      });
    } catch (error) {
      if (currentVerification !== verificationId.current) return;
      setAddressError(
        error instanceof Error
          ? error.message
          : "We could not verify that address.",
      );
    } finally {
      if (currentVerification === verificationId.current) setAddressLoading(false);
    }
  };

  const onAddressChange = (eventAddress: string) => {
    verificationId.current++;
    setAddressLoading(false);
    setAddressResult(null);
    setAddressError(null);
    patch({ eventAddress, distanceMiles: "" });
  };

  return (
    <div className={step === 4 ? "hidden" : "grid gap-4 sm:grid-cols-2"}>
        <label className={step === 1 ? "block sm:col-span-2" : "hidden"}>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Full name
          </span>
          <input
            type="text"
            name="customerName"
            aria-invalid={Boolean(errors.customerName)}
            aria-describedby={errors.customerName ? "error-customerName" : undefined}
            required
            autoComplete="name"
            value={value.customerName}
            onChange={(e) => patch({ customerName: e.target.value })}
            className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#071326]/80 px-3 py-3 text-base text-white outline-none ring-cyan-400/0 transition placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/30 aria-[invalid=true]:border-rose-400 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-rose-400/25"
            placeholder="Jordan Lee"
          />

          {errors.customerName && <p id="error-customerName" className="mt-2 text-sm font-semibold text-rose-200">{errors.customerName}</p>}
        </label>
        <label className={step === 1 ? "block" : "hidden"}>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Email
          </span>
          <input
            type="email"
            name="customerEmail"
            aria-invalid={Boolean(errors.customerEmail)}
            aria-describedby={errors.customerEmail ? "error-customerEmail" : undefined}
            required
            autoComplete="email"
            value={value.customerEmail}
            onChange={(e) => patch({ customerEmail: e.target.value })}
            className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#071326]/80 px-3 py-3 text-base text-white outline-none ring-cyan-400/0 transition placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/30 aria-[invalid=true]:border-rose-400 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-rose-400/25"
            placeholder="you@example.com"
          />

          {errors.customerEmail && <p id="error-customerEmail" className="mt-2 text-sm font-semibold text-rose-200">{errors.customerEmail}</p>}
        </label>
        <label className={step === 1 ? "block" : "hidden"}>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Phone
          </span>
          <input
            type="tel"
            name="customerPhone"
            aria-invalid={Boolean(errors.customerPhone)}
            aria-describedby={errors.customerPhone ? "error-customerPhone" : undefined}
            required
            autoComplete="tel"
            value={value.customerPhone}
            onChange={(e) => patch({ customerPhone: e.target.value })}
            className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#071326]/80 px-3 py-3 text-base text-white outline-none ring-cyan-400/0 transition placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/30 aria-[invalid=true]:border-rose-400 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-rose-400/25"
            placeholder="(864) 555-0199"
          />

          {errors.customerPhone && <p id="error-customerPhone" className="mt-2 text-sm font-semibold text-rose-200">{errors.customerPhone}</p>}
        </label>
        <label className={step === 2 ? "block sm:col-span-2" : "hidden"}>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Event address
          </span>
          <textarea
            name="eventAddress"
            aria-invalid={Boolean(errors.eventAddress)}
            aria-describedby={errors.eventAddress ? "error-eventAddress" : undefined}
            required
            rows={3}
            value={value.eventAddress}
            onChange={(e) => onAddressChange(e.target.value)}
            className="mt-1.5 w-full resize-y rounded-xl border border-white/15 bg-[#071326]/80 px-3 py-3 text-base text-white outline-none ring-cyan-400/0 transition placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/30 aria-[invalid=true]:border-rose-400 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-rose-400/25"
            placeholder="Street, city, ZIP — helps us plan delivery"
          />
          <button
            type="button"
            onClick={verifyAddress}
            disabled={addressLoading || value.eventAddress.trim().length < 8}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-black uppercase tracking-wide text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-slate-600"
          >
            {addressLoading ? "Checking address..." : "Verify address"}
          </button>
          {addressError && (
            <p className="mt-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
              {addressError}
            </p>
          )}
          {addressResult && (
            <div className="mt-3 space-y-3 rounded-xl border border-emerald-300/25 bg-emerald-300/[0.06] p-3 text-sm text-slate-200">
              <div>
                <p className="font-semibold text-emerald-100">
                  Address verified
                </p>
                <p className="mt-1 text-slate-300">
                  {addressResult.formattedAddress}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {addressResult.distanceText ??
                    `${addressResult.distanceMiles} miles`}{" "}
                  estimated driving one way from {addressResult.originAddress}
                  {addressResult.durationText
                    ? ` - about ${addressResult.durationText} driving`
                    : ""}
                </p>
                {routeUrl && (
                  <a
                    href={routeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex text-xs font-bold text-emerald-100 underline decoration-emerald-200/50 underline-offset-4 hover:text-white"
                  >
                    Open driving route in Google Maps
                  </a>
                )}
              </div>
              {mapSrc && (
                <iframe
                  title="Verified event address map"
                  src={mapSrc}
                  className="h-56 w-full rounded-lg border border-white/10"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              )}
            </div>
          )}

          {errors.eventAddress && <p id="error-eventAddress" className="mt-2 text-sm font-semibold text-rose-200">{errors.eventAddress}</p>}
        </label>
        <label className={step === 2 ? "block" : "hidden"}>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Delivery miles (calculated)
          </span>
          <input
            type="number"
            name="distanceMiles"
            min="0"
            step="0.1"
            inputMode="decimal"
            value={value.distanceMiles}
            onChange={(e) => patch({ distanceMiles: e.target.value })}
            readOnly
            className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#071326]/60 px-3 py-3 text-base text-slate-200 outline-none"
            placeholder="Verify address first"
          />
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Estimated driving distance from Google Maps. The first 25 miles
            are included; after that, mileage is $2 per one-way mile.
          </p>
        </label>
        <label className={step === 2 ? "block" : "hidden"}>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Setup surface
          </span>
          <select
            name="setupSurface"
            aria-invalid={Boolean(errors.setupSurface)}
            aria-describedby={errors.setupSurface ? "error-setupSurface" : undefined}
            required
            value={value.setupSurface}
            onChange={(e) => patch({ setupSurface: e.target.value })}
            className="mt-1.5 w-full appearance-none rounded-xl border border-white/15 bg-[#071326]/80 px-3 py-3 text-base text-white outline-none ring-cyan-400/0 transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/30 aria-[invalid=true]:border-rose-400 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-rose-400/25"
          >
            <option value="">Select surface</option>
            <option value="Grass">Grass</option>
            <option value="Concrete">Concrete</option>
            <option value="Asphalt">Asphalt</option>
            <option value="Indoor">Indoor</option>
            <option value="Other / unsure">Other / unsure</option>
          </select>

          {errors.setupSurface && <p id="error-setupSurface" className="mt-2 text-sm font-semibold text-rose-200">{errors.setupSurface}</p>}
        </label>
        <label className={step === 2 ? "block sm:col-span-2" : "hidden"}>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Setup access
          </span>
          <select
            name="setupAccess"
            aria-invalid={Boolean(errors.setupAccess)}
            aria-describedby={errors.setupAccess ? "error-setupAccess" : undefined}
            required
            value={value.setupAccess}
            onChange={(e) => patch({ setupAccess: e.target.value })}
            className="mt-1.5 w-full appearance-none rounded-xl border border-white/15 bg-[#071326]/80 px-3 py-3 text-base text-white outline-none ring-cyan-400/0 transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/30 aria-[invalid=true]:border-rose-400 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-rose-400/25"
          >
            <option value="">Select access</option>
            <option value="Vehicle can drive to setup area">
              Vehicle can drive to setup area
            </option>
            <option value="Hand trucks required">Hand trucks required</option>
            <option value="Stairs, hills, or narrow gate">
              Stairs, hills, or narrow gate
            </option>
            <option value="Other / unsure">Other / unsure</option>
          </select>

          {errors.setupAccess && <p id="error-setupAccess" className="mt-2 text-sm font-semibold text-rose-200">{errors.setupAccess}</p>}
        </label>
        <label className={step === 3 ? "block sm:col-span-2" : "hidden"}>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Payment preference
          </span>
          <select
            name="paymentMethod"
            aria-invalid={Boolean(errors.paymentMethod)}
            aria-describedby={errors.paymentMethod ? "error-paymentMethod" : undefined}
            required
            value={value.paymentMethod}
            onChange={(e) => patch({ paymentMethod: e.target.value })}
            className="mt-1.5 w-full appearance-none rounded-xl border border-white/15 bg-[#071326]/80 px-3 py-3 text-base text-white outline-none ring-cyan-400/0 transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/30 aria-[invalid=true]:border-rose-400 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-rose-400/25"
          >
            <option value="">Select payment method</option>
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
          </select>

          {errors.paymentMethod && <p id="error-paymentMethod" className="mt-2 text-sm font-semibold text-rose-200">{errors.paymentMethod}</p>}
        </label>
        <label className={step === 2 ? "block sm:col-span-2" : "hidden"}>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Setup notes (optional)
          </span>
          <textarea
            name="setupNotes"
            aria-invalid={Boolean(errors.setupNotes)}
            aria-describedby={errors.setupNotes ? "error-setupNotes" : undefined}
            rows={3}
            value={value.setupNotes}
            onChange={(e) => patch({ setupNotes: e.target.value })}
            className="mt-1.5 w-full resize-y rounded-xl border border-white/15 bg-[#071326]/80 px-3 py-3 text-base text-white outline-none ring-cyan-400/0 transition placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/30 aria-[invalid=true]:border-rose-400 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-rose-400/25"
            placeholder="Gate width, slope, stairs, power location, or anything we should know"
          />

          {errors.setupNotes && <p id="error-setupNotes" className="mt-2 text-sm font-semibold text-rose-200">{errors.setupNotes}</p>}
        </label>
    </div>
  );
}
