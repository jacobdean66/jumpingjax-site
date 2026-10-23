"use client";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import {
  personalGoogleCode,
  type GoogleOfferKind,
} from "@/lib/analytics/customer-offer";
const EVENT = "jax-google-offer-change";
function read(kind: GoogleOfferKind) {
  try {
    return personalGoogleCode(localStorage.getItem(`jax-google-offer-${kind}`));
  } catch {
    return "";
  }
}
function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
function save(code: string, kind: GoogleOfferKind) {
  localStorage.setItem(`jax-google-offer-${kind}`, code);
  window.dispatchEvent(new Event(EVENT));
}
export function useGoogleOffer(kind: GoogleOfferKind) {
  return useSyncExternalStore(
    subscribe,
    () => read(kind),
    () => "",
  );
}
export function useRentalPromotion() {
  return useGoogleOffer("rental");
}
export function RentalPromotionNotice({ dark = false }: { dark?: boolean }) {
  const code = useRentalPromotion();
  if (!code) return null;
  return (
    <aside
      role="status"
      aria-label="Saved rental discount"
      className={`mb-5 rounded-2xl border p-4 text-sm ${dark ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100" : "border-emerald-300 bg-emerald-50 text-emerald-950"}`}
    >
      <p className="font-black">
        Your Google rental offer is saved. 15% off eligible inflatables.
      </p>
      <p className="mt-1">
        Use the email you claimed with. Savings appear in your estimate and
        agreement. Delivery and other services excluded.
      </p>
      <nav
        aria-label="Eligible rental categories"
        className="mt-3 flex flex-wrap gap-3 font-bold underline"
      >
        <Link href="/rentals/bounce-houses#rental-units">Bounce houses</Link>
        <Link href="/rentals/combos#rental-units">Combos</Link>
        <Link href="/rentals/obstacle-courses#rental-units">
          Obstacle courses
        </Link>
      </nav>
    </aside>
  );
}
export function RentalPromotionEntry({
  discount,
  eligibleItems,
  kind = "rental",
}: {
  discount: number;
  eligibleItems: boolean;
  kind?: GoogleOfferKind;
}) {
  const code = useGoogleOffer(kind);
  const [entered, setEntered] = useState("");
  const [error, setError] = useState("");
  function apply() {
    const valid = personalGoogleCode(entered);
    if (!valid) {
      setError(
        "Claim your personal code on the Google discount page first. The old GOOGLE15 code has been replaced.",
      );
      return;
    }
    try {
      save(valid, kind);
      setError("");
    } catch {
      setError("Allow browser storage, then enter your code again.");
    }
  }
  return (
    <section
      aria-label="Google offer"
      className="my-4 rounded-xl border border-emerald-300/30 bg-emerald-400/10 p-4 text-sm text-emerald-100"
    >
      {code ? (
        <>
          <p role="status" className="font-bold">
            {discount > 0
              ? `Google offer estimate: you save $${discount.toFixed(2)}.`
              : eligibleItems
                ? "Google code saved. Choose your date to see the savings."
                : "Choose an eligible inflatable to use your Google offer."}
          </p>
          <p className="mt-2 break-all text-xs">Code: {code}</p>
          <p className="mt-1 text-xs">
            Use the email you claimed with. The code is checked when you submit.
          </p>
          <button
            type="button"
            className="mt-2 underline"
            onClick={() => {
              localStorage.removeItem(`jax-google-offer-${kind}`);
              window.dispatchEvent(new Event(EVENT));
            }}
          >
            Change / remove code
          </button>
        </>
      ) : (
        <>
          <label htmlFor={`google-code-${kind}`} className="font-bold">
            Have a Google discount code?
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              id={`google-code-${kind}`}
              value={entered}
              onChange={(e) => setEntered(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  apply();
                }
              }}
              maxLength={36}
              autoComplete="off"
              className="min-h-11 min-w-0 flex-1 rounded-lg bg-slate-950 px-3 text-white"
            />
            <button
              type="button"
              onClick={apply}
              className="min-h-11 rounded-full bg-cyan-300 px-4 font-black text-slate-950"
            >
              Apply code
            </button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="mt-2 text-amber-200">
          {error}
        </p>
      )}
      <Link
        href={`/offers/inflatables-15?kind=${kind}`}
        className="mt-2 inline-block underline"
      >
        Claim or retrieve my personal Google code
      </Link>
      <p className="mt-2 text-xs">
        {kind === "facility"
          ? "15% off the base party package before tax. Add-ons and Open Play excluded."
          : "15% off eligible bounce houses, combos and obstacle courses. Delivery and other services excluded."}
      </p>
    </section>
  );
}
export function ClaimRentalPromotion({
  initialKind = "rental",
}: {
  initialKind?: GoogleOfferKind;
}) {
  const [kind, setKind] = useState<GoogleOfferKind>(initialKind);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [issued, setIssued] = useState("");
  async function claim() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/offers/google/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, kind }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Your offer could not be saved.");
      setIssued(body.code);
      setUnavailable(body.unavailable);
      setClaimed(true);
      try {
        save(body.code, kind);
      } catch {
        setError(
          "Your code is saved on our server. This browser could not remember it; copy it and enter it at checkout.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-5 space-y-4">
      <label className="block text-sm font-bold">
        What are you booking?
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as GoogleOfferKind);
            setClaimed(false);
            setIssued("");
            setUnavailable(false);
          }}
          className="mt-2 block min-h-11 w-full rounded-xl bg-slate-900 p-3 text-white"
        >
          <option value="rental">Inflatable rental</option>
          <option value="facility">Facility party</option>
        </select>
      </label>
      {!claimed ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void claim();
          }}
        >
          <label
            htmlFor="google-offer-email"
            className="block text-sm font-bold"
          >
            Your booking email
          </label>
          <input
            id="google-offer-email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 min-h-12 w-full rounded-xl bg-slate-900 px-4 text-white"
          />
          <p className="mt-2 text-xs text-slate-300">
            Use this same email when booking. Returning? Enter it to retrieve
            your code.
          </p>
          <button
            disabled={busy}
            className="mt-4 min-h-12 rounded-full bg-cyan-300 px-6 py-3 font-black text-slate-950"
          >
            {busy ? "Saving your offer…" : "Get my personal 15% code"}
          </button>
        </form>
      ) : (
        <div
          role="status"
          className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 p-4"
        >
          <p className="font-black">
            {unavailable
              ? "Your offer is already attached to a booking."
              : "Your Google discount is saved."}
          </p>
          <p className="mt-2 break-all text-sm">
            Your code: <code className="select-all">{issued}</code>
          </p>
          {unavailable ? (
            <p className="mt-2 text-sm">
              Contact Jumping Jax about that booking. This code cannot be used
              on a second booking.
            </p>
          ) : (
            <Link
              href={
                kind === "rental"
                  ? "/rentals#rental-categories"
                  : "/facility-parties#facility-booking"
              }
              className="mt-4 inline-flex min-h-12 items-center rounded-full bg-cyan-300 px-5 py-3 font-black text-slate-950"
            >
              Go to website &amp; use my code →
            </Link>
          )}
          <p className="mt-3 text-sm">
            {unavailable
              ? ""
              : "Your code is automatically entered in this browser when storage is available. You can also copy it for later. Savings will appear before you submit, and staff will see the offer on your booking card."}
          </p>
          <button
            type="button"
            className="mt-3 text-sm underline"
            onClick={() => setClaimed(false)}
          >
            Check a different email
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-amber-200">
          {error}
        </p>
      )}
    </div>
  );
}
