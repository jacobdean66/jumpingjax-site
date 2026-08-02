"use client";

import { useMemo, useState } from "react";
import {
  inflatableSetupCartLines,
  validateInflatableSetupDistances,
  type InflatableSetupDistanceDrafts,
  type RentalCartLineInput,
} from "@/lib/rentals/inflatable-setup-distances";

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
  inflatableSetupDistances: InflatableSetupDistanceDrafts;
};

type Props = {
  value: CustomerFields;
  onChange: (next: CustomerFields) => void;
  cartItems: RentalCartLineInput[];
  attemptedSubmit?: boolean;
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

export function CustomerForm({
  value,
  onChange,
  cartItems,
  attemptedSubmit = false,
}: Props) {
  const [addressResult, setAddressResult] =
    useState<AddressDistanceResult | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [touchedSetupFields, setTouchedSetupFields] = useState<
    Record<string, { power?: boolean; water?: boolean }>
  >({});

  const patch = (partial: Partial<CustomerFields>) =>
    onChange({ ...value, ...partial });

  const inflatableLines = useMemo(
    () => inflatableSetupCartLines(cartItems),
    [cartItems],
  );

  const setupDistanceErrors = useMemo(
    () =>
      validateInflatableSetupDistances(
        inflatableLines,
        value.inflatableSetupDistances,
      ),
    [inflatableLines, value.inflatableSetupDistances],
  );

  const patchSetupDistance = (
    rentalItemId: string,
    field: "power" | "water",
    fieldValue: string,
  ) => {
    const current = value.inflatableSetupDistances[rentalItemId] ?? {
      power: "",
      water: "",
    };
    patch({
      inflatableSetupDistances: {
        ...value.inflatableSetupDistances,
        [rentalItemId]: { ...current, [field]: fieldValue },
      },
    });
  };

  const markSetupFieldTouched = (
    rentalItemId: string,
    field: "power" | "water",
  ) => {
    setTouchedSetupFields((prev) => ({
      ...prev,
      [rentalItemId]: { ...prev[rentalItemId], [field]: true },
    }));
  };

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

      setAddressResult(nextResult);
      patch({
        eventAddress: nextResult.formattedAddress,
        distanceMiles: String(nextResult.distanceMiles),
      });
    } catch (error) {
      setAddressError(
        error instanceof Error
          ? error.message
          : "We could not verify that address.",
      );
    } finally {
      setAddressLoading(false);
    }
  };

  const onAddressChange = (eventAddress: string) => {
    setAddressResult(null);
    setAddressError(null);
    patch({ eventAddress, distanceMiles: "" });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <h3 className="text-sm font-black uppercase tracking-wide text-cyan-200">
        Your details
      </h3>
      <p className="mt-2 text-xs text-slate-400">
        We&apos;ll only use this to follow up on your request (not sent anywhere
        in this demo).
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Full name
          </span>
          <input
            type="text"
            name="customerName"
            autoComplete="name"
            value={value.customerName}
            onChange={(e) => patch({ customerName: e.target.value })}
            className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#071326]/80 px-3 py-3 text-base text-white outline-none ring-cyan-400/0 transition placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/30"
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
            value={value.customerEmail}
            onChange={(e) => patch({ customerEmail: e.target.value })}
            className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#071326]/80 px-3 py-3 text-base text-white outline-none ring-cyan-400/0 transition placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/30"
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
            value={value.customerPhone}
            onChange={(e) => patch({ customerPhone: e.target.value })}
            className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#071326]/80 px-3 py-3 text-base text-white outline-none ring-cyan-400/0 transition placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/30"
            placeholder="(864) 555-0199"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Event address
          </span>
          <textarea
            name="eventAddress"
            rows={3}
            value={value.eventAddress}
            onChange={(e) => onAddressChange(e.target.value)}
            className="mt-1.5 w-full resize-y rounded-xl border border-white/15 bg-[#071326]/80 px-3 py-3 text-base text-white outline-none ring-cyan-400/0 transition placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/30"
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
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            One-way delivery miles
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
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Setup surface
          </span>
          <select
            name="setupSurface"
            required
            value={value.setupSurface}
            onChange={(e) => patch({ setupSurface: e.target.value })}
            className="mt-1.5 w-full appearance-none rounded-xl border border-white/15 bg-[#071326]/80 px-3 py-3 text-base text-white outline-none ring-cyan-400/0 transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/30"
          >
            <option value="">Select surface</option>
            <option value="Grass">Grass</option>
            <option value="Concrete">Concrete</option>
            <option value="Asphalt">Asphalt</option>
            <option value="Indoor">Indoor</option>
            <option value="Other / unsure">Other / unsure</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Setup access
          </span>
          <select
            name="setupAccess"
            required
            value={value.setupAccess}
            onChange={(e) => patch({ setupAccess: e.target.value })}
            className="mt-1.5 w-full appearance-none rounded-xl border border-white/15 bg-[#071326]/80 px-3 py-3 text-base text-white outline-none ring-cyan-400/0 transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/30"
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
        </label>

        {inflatableLines.length > 0 && (
          <div className="block sm:col-span-2">
            <h4 className="text-sm font-black uppercase tracking-wide text-cyan-200">
              Inflatable Setup Locations
            </h4>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Please estimate each distance so our crew can bring the correct
              extension cords, hoses, and setup equipment.
            </p>
            <div className="mt-3 space-y-3">
              {inflatableLines.map((line) => {
                const draft = value.inflatableSetupDistances[
                  line.rentalItemId
                ] ?? { power: "", water: "" };
                const errors = setupDistanceErrors[line.rentalItemId];
                const touched = touchedSetupFields[line.rentalItemId];
                const showPowerError =
                  Boolean(errors?.power) && (attemptedSubmit || touched?.power);
                const showWaterError =
                  Boolean(errors?.water) && (attemptedSubmit || touched?.water);
                const powerFieldId = `setup-power-${line.rentalItemId}`;
                const waterFieldId = `setup-water-${line.rentalItemId}`;

                return (
                  <div
                    key={line.rentalItemId}
                    className="rounded-xl border border-white/15 bg-[#071326]/60 p-3"
                  >
                    <p className="truncate text-sm font-bold text-white">
                      {line.rentalName}
                    </p>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <label className="block" htmlFor={powerFieldId}>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Distance from power outlet
                        </span>
                        <div className="mt-1.5 flex items-center gap-2">
                          <input
                            id={powerFieldId}
                            type="number"
                            required
                            min="0"
                            step="any"
                            inputMode="decimal"
                            value={draft.power}
                            onChange={(e) =>
                              patchSetupDistance(
                                line.rentalItemId,
                                "power",
                                e.target.value,
                              )
                            }
                            onBlur={() =>
                              markSetupFieldTouched(line.rentalItemId, "power")
                            }
                            aria-invalid={showPowerError}
                            aria-describedby={
                              showPowerError ? `${powerFieldId}-error` : undefined
                            }
                            className="w-full min-w-0 rounded-xl border border-white/15 bg-[#071326]/80 px-3 py-3 text-base text-white outline-none ring-cyan-400/0 transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/30"
                            placeholder="e.g. 50"
                          />
                          <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-slate-400">
                            feet
                          </span>
                        </div>
                        {showPowerError && (
                          <p
                            id={`${powerFieldId}-error`}
                            role="alert"
                            className="mt-1.5 text-xs text-rose-300"
                          >
                            {errors!.power}
                          </p>
                        )}
                      </label>

                      {line.kind === "waterslide" && (
                        <label className="block" htmlFor={waterFieldId}>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Distance from water hookup
                          </span>
                          <div className="mt-1.5 flex items-center gap-2">
                            <input
                              id={waterFieldId}
                              type="number"
                              required
                              min="0"
                              step="any"
                              inputMode="decimal"
                              value={draft.water}
                              onChange={(e) =>
                                patchSetupDistance(
                                  line.rentalItemId,
                                  "water",
                                  e.target.value,
                                )
                              }
                              onBlur={() =>
                                markSetupFieldTouched(line.rentalItemId, "water")
                              }
                              aria-invalid={showWaterError}
                              aria-describedby={
                                showWaterError
                                  ? `${waterFieldId}-error`
                                  : undefined
                              }
                              className="w-full min-w-0 rounded-xl border border-white/15 bg-[#071326]/80 px-3 py-3 text-base text-white outline-none ring-cyan-400/0 transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/30"
                              placeholder="e.g. 100"
                            />
                            <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-slate-400">
                              feet
                            </span>
                          </div>
                          {showWaterError && (
                            <p
                              id={`${waterFieldId}-error`}
                              role="alert"
                              className="mt-1.5 text-xs text-rose-300"
                            >
                              {errors!.water}
                            </p>
                          )}
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <label className="block sm:col-span-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            How will you pay?
          </span>
          <select
            name="paymentMethod"
            required
            value={value.paymentMethod}
            onChange={(e) => patch({ paymentMethod: e.target.value })}
            className="mt-1.5 w-full appearance-none rounded-xl border border-white/15 bg-[#071326]/80 px-3 py-3 text-base text-white outline-none ring-cyan-400/0 transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/30"
          >
            <option value="">Select payment method</option>
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Setup notes
          </span>
          <textarea
            name="setupNotes"
            rows={3}
            value={value.setupNotes}
            onChange={(e) => patch({ setupNotes: e.target.value })}
            className="mt-1.5 w-full resize-y rounded-xl border border-white/15 bg-[#071326]/80 px-3 py-3 text-base text-white outline-none ring-cyan-400/0 transition placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/30"
            placeholder="Gate width, slope, stairs, power location, or anything we should know"
          />
        </label>
      </div>
    </div>
  );
}
