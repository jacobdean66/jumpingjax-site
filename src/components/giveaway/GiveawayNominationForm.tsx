"use client";

import { FormEvent, useMemo, useState } from "react";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const inputClass =
  "mt-2 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-base text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100";

export function GiveawayNominationForm() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const days = useMemo(() => Array.from({ length: 31 }, (_, index) => index + 1), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const data = new FormData(event.currentTarget);
    const payload = Object.fromEntries(data.entries());
    const response = await fetch("/api/giveaway/nominate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        child_birth_month: Number(payload.child_birth_month),
        child_birth_day: Number(payload.child_birth_day),
        permission_acknowledged: data.get("permission_acknowledged") === "yes",
        idempotency_key: idempotencyKey,
      }),
    });
    const result = await response.json().catch(() => ({}));
    setSubmitting(false);

    if (!response.ok) {
      setError(result.error || "We could not submit the nomination. Please try again.");
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-[2rem] border-4 border-emerald-300 bg-white p-8 text-center shadow-xl">
        <div className="text-5xl" aria-hidden="true">🎉</div>
        <h2 className="mt-4 text-3xl font-black text-slate-950">Nomination received!</h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-700">
          We sent a confirmation to your email. Thank you for helping us celebrate a special child.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-[2rem] border-4 border-cyan-200 bg-white p-5 shadow-2xl sm:p-8">
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="font-bold text-slate-800">
          Your name
          <input name="nominator_name" required maxLength={120} autoComplete="name" className={inputClass} />
        </label>
        <label className="font-bold text-slate-800">
          Your email
          <input name="nominator_email" type="email" required maxLength={254} autoComplete="email" className={inputClass} />
        </label>
      </div>

      <label className="mt-6 block font-bold text-slate-800">
        Child&apos;s first name and last initial
        <input name="child_name" required maxLength={80} placeholder="Example: Avery J." className={inputClass} />
        <span className="mt-2 block text-xs font-medium text-slate-500">Please do not enter the child&apos;s full last name.</span>
      </label>

      <fieldset className="mt-6">
        <legend className="font-bold text-slate-800">Child&apos;s birthday (month and day only)</legend>
        <div className="grid grid-cols-2 gap-4">
          <label className="sr-only" htmlFor="birth-month">Birth month</label>
          <select id="birth-month" name="child_birth_month" required defaultValue="" className={inputClass}>
            <option value="" disabled>Month</option>
            {months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
          </select>
          <label className="sr-only" htmlFor="birth-day">Birth day</label>
          <select id="birth-day" name="child_birth_day" required defaultValue="" className={inputClass}>
            <option value="" disabled>Day</option>
            {days.map((day) => <option key={day} value={day}>{day}</option>)}
          </select>
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="font-bold text-slate-800">Choose the party nomination</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="cursor-pointer rounded-2xl border-2 border-pink-200 bg-pink-50 p-4 font-black text-pink-950 has-[:checked]:border-pink-500 has-[:checked]:ring-4 has-[:checked]:ring-pink-100">
            <input type="radio" name="party_choice" value="september_birthday" required className="mr-3 accent-pink-500" />
            September birthday party
          </label>
          <label className="cursor-pointer rounded-2xl border-2 border-cyan-200 bg-cyan-50 p-4 font-black text-cyan-950 has-[:checked]:border-cyan-500 has-[:checked]:ring-4 has-[:checked]:ring-cyan-100">
            <input type="radio" name="party_choice" value="back_to_school" required className="mr-3 accent-cyan-500" />
            Back-to-school party
          </label>
        </div>
      </fieldset>

      <label className="mt-6 block font-bold text-slate-800">
        Why are you nominating this child?
        <textarea name="nomination_reason" required minLength={10} maxLength={1500} rows={5} className={inputClass} />
      </label>

      <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <label className="mt-6 flex items-start gap-3 rounded-2xl bg-slate-100 p-4 text-sm font-semibold text-slate-700">
        <input type="checkbox" name="permission_acknowledged" value="yes" required className="mt-1 h-5 w-5 shrink-0 accent-cyan-500" />
        <span>I have permission to share this child&apos;s first name, last initial, and birthday month/day. A parent or legal guardian must approve the prize if this child is selected.</span>
      </label>

      {error ? <p className="mt-5 rounded-xl bg-rose-50 p-3 font-bold text-rose-700">{error}</p> : null}

      <button type="submit" disabled={submitting} className="mt-6 w-full rounded-full bg-orange-500 px-6 py-4 text-lg font-black uppercase tracking-wide text-white shadow-[0_7px_0_#c2410c] transition hover:-translate-y-0.5 hover:bg-orange-400 disabled:cursor-wait disabled:opacity-60">
        {submitting ? "Submitting…" : "Submit nomination"}
      </button>
      <p className="mt-4 text-center text-xs text-slate-500">No purchase necessary. One nomination does not guarantee selection.</p>
    </form>
  );
}

