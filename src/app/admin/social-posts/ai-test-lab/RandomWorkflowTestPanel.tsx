"use client";

import { useState } from "react";
import {
  buildRandomWorkflowSelection,
  createSeededRng,
  type RandomWorkflowChoice,
} from "@/lib/social-posts/random-workflow-test";

export function RandomWorkflowTestPanel() {
  const [seed, setSeed] = useState(() => Date.now() % 1_000_000);
  const [selection, setSelection] = useState<RandomWorkflowChoice | null>(null);
  const [error, setError] = useState("");

  const roll = (nextSeed?: number) => {
    try {
      const value = nextSeed ?? (Date.now() % 1_000_000);
      setSeed(value);
      setSelection(buildRandomWorkflowSelection(createSeededRng(value)));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Random selection failed.");
      setSelection(null);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
        Randomized AI workflow test
      </p>
      <h2 className="mt-1 text-2xl font-black">Explore a random valid combo</h2>
      <p className="mt-2 text-sm font-semibold text-slate-600">
        Picks only from valid inventory assets and supported campaign/option
        values. Does not draft, approve, schedule, or publish.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => roll()}
          className="rounded-xl bg-violet-700 px-4 py-3 text-sm font-black text-white hover:bg-violet-800"
        >
          {selection ? "Regenerate random combo" : "Run random test"}
        </button>
        <button
          type="button"
          onClick={() => roll(seed + 1)}
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-900"
        >
          Next seed
        </button>
      </div>

      <p className="mt-3 text-xs font-bold text-slate-500">Seed: {seed}</p>
      {error ? (
        <p className="mt-3 text-sm font-bold text-rose-700">{error}</p>
      ) : null}

      {selection ? (
        <dl className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
          {(
            [
              ["Asset", `${selection.assetTitle} (${selection.assetSlug})`],
              ["Campaign", `${selection.campaignLabel} (${selection.campaignId})`],
              ["Business focus", selection.businessFocus],
              ["Audience", selection.audience],
              ["Post type", selection.postType],
              ["Visual concept", selection.visualConcept],
              ["Copy style", selection.copyStyle],
              ["Platform", selection.platform],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                {label}
              </dt>
              <dd className="mt-1 font-bold text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
