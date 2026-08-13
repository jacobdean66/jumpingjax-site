"use client";

import { FormEvent, useState } from "react";

type SubmissionState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; nominationId: string }
  | { kind: "error"; message: string };

const fieldClass =
  "mt-2 min-h-12 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-pink-500 focus:ring-4 focus:ring-pink-100";

export default function NominationForm() {
  const [state, setState] = useState<SubmissionState>({ kind: "idle" });

  async function submitNomination(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ kind: "submitting" });

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const response = await fetch("/api/nominate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = (await response.json()) as {
        nominationId?: string;
        error?: string;
      };

      if (!response.ok || !result.nominationId) {
        throw new Error(result.error || "We couldn't send your nomination. Please try again.");
      }

      form.reset();
      setState({ kind: "success", nominationId: result.nominationId });
    } catch (error) {
      setState({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "We couldn't send your nomination. Please try again.",
      });
    }
  }

  if (state.kind === "success") {
    return (
      <div className="rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-7 text-center" role="status">
        <div className="text-4xl" aria-hidden="true">Hooray!</div>
        <h2 className="mt-3 text-2xl font-black text-emerald-950">Nomination received!</h2>
        <p className="mt-3 leading-7 text-emerald-900">
          Thank you for helping us celebrate a local child. We sent a confirmation to your email.
        </p>
        <p className="mt-2 text-sm font-semibold text-emerald-800">
          Confirmation: {state.nominationId}
        </p>
        <button
          type="button"
          onClick={() => setState({ kind: "idle" })}
          className="mt-6 min-h-12 rounded-full bg-emerald-700 px-6 font-bold text-white transition hover:bg-emerald-800"
        >
          Submit another nomination
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submitNomination} className="space-y-5">
      <div className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="font-bold text-slate-900">
          Your name
          <input className={fieldClass} name="nominatorName" autoComplete="name" maxLength={100} required />
        </label>
        <label className="font-bold text-slate-900">
          Your email
          <input className={fieldClass} name="nominatorEmail" type="email" autoComplete="email" maxLength={200} required />
        </label>
        <label className="font-bold text-slate-900">
          Child&apos;s first name
          <input className={fieldClass} name="childName" maxLength={80} required />
        </label>
        <label className="font-bold text-slate-900">
          Child&apos;s birthday (MM/DD)
          <input className={fieldClass} name="birthday" placeholder="09/14" inputMode="numeric" pattern="(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])" required />
        </label>
      </div>

      <fieldset>
        <legend className="font-bold text-slate-900">Which party should they be considered for?</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            ["September birthday party", "September birthday party"],
            ["Back-to-school party", "Back-to-school party"],
          ].map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white p-4 font-semibold text-slate-900 transition hover:border-cyan-400">
              <input type="radio" name="partyChoice" value={value} required className="h-5 w-5 accent-pink-600" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block font-bold text-slate-900">
        Why are you nominating this child?
        <textarea
          className={`${fieldClass} min-h-36 resize-y`}
          name="whyNominated"
          minLength={20}
          maxLength={2000}
          placeholder="Tell us how this party would make a difference for the child and their family."
          required
        />
      </label>

      <label className="flex items-start gap-3 rounded-2xl bg-cyan-50 p-4 text-sm font-semibold leading-6 text-slate-800">
        <input type="checkbox" name="acknowledgement" value="yes" required className="mt-1 h-5 w-5 shrink-0 accent-pink-600" />
        <span>I understand that a parent or legal guardian must approve before the prize can be redeemed and that submitting a nomination does not guarantee selection.</span>
      </label>

      {state.kind === "error" && (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={state.kind === "submitting"}
        className="min-h-14 w-full rounded-full bg-pink-600 px-7 text-lg font-black text-white shadow-lg shadow-pink-200 transition hover:bg-pink-700 disabled:cursor-wait disabled:opacity-70"
      >
        {state.kind === "submitting" ? "Sending nomination..." : "Submit nomination"}
      </button>
    </form>
  );
}

