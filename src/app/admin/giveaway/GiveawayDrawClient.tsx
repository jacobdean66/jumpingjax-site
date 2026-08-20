"use client";

import { useMemo, useState } from "react";

import { pickSecureRandomIndex } from "@/lib/giveaway/public-nominee-display";

export type GiveawayDrawNominee = {
  id: string;
  childName: string;
  birthday: string;
  partyChoice: string;
  reason: string;
  nominatorName: string;
};

export function GiveawayDrawClient({ nominees }: { nominees: GiveawayDrawNominee[] }) {
  const [eligibleIds, setEligibleIds] = useState(() => new Set(nominees.map((nominee) => nominee.id)));
  const [winnerId, setWinnerId] = useState<string | null>(null);

  const eligibleNominees = useMemo(
    () => nominees.filter((nominee) => eligibleIds.has(nominee.id)),
    [eligibleIds, nominees],
  );
  const winner = nominees.find((nominee) => nominee.id === winnerId) ?? null;

  function toggleNominee(id: string) {
    setWinnerId(null);
    setEligibleIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function drawWinner() {
    if (eligibleNominees.length === 0) return;
    setWinnerId(eligibleNominees[pickSecureRandomIndex(eligibleNominees.length)].id);
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <p className="text-sm font-black text-slate-950">
              {eligibleNominees.length} of {nominees.length} nominees in this draw
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Uncheck anyone you do not want included in the random shortlist.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setWinnerId(null);
                setEligibleIds(new Set(nominees.map((nominee) => nominee.id)));
              }}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
            >
              Include all
            </button>
            <button
              type="button"
              onClick={() => {
                setWinnerId(null);
                setEligibleIds(new Set());
              }}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
            >
              Clear shortlist
            </button>
          </div>
        </div>

        {nominees.map((nominee) => {
          const included = eligibleIds.has(nominee.id);
          return (
            <label
              key={nominee.id}
              className={`block cursor-pointer rounded-2xl border-2 bg-white p-5 shadow-sm transition ${
                included
                  ? "border-sky-400 ring-2 ring-sky-100"
                  : "border-slate-200 opacity-65 hover:opacity-100"
              }`}
            >
              <div className="flex items-start gap-4">
                <input
                  type="checkbox"
                  checked={included}
                  onChange={() => toggleNominee(nominee.id)}
                  className="mt-1 h-5 w-5 shrink-0 accent-sky-600"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-xl font-black text-slate-950">{nominee.childName}</h2>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                      {nominee.partyChoice}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Birthday {nominee.birthday} · Nominated by {nominee.nominatorName}
                  </p>
                  <p className="mt-4 whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-700">
                    {nominee.reason}
                  </p>
                </div>
              </div>
            </label>
          );
        })}
      </section>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-300">Winner picker</p>
          <h2 className="mt-3 text-2xl font-black">Random draw</h2>
          <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-300">
            Every checked nominee has exactly the same chance. Shortlist based on the stories first if you want the draw weighted by your judgment.
          </p>
          <button
            type="button"
            onClick={drawWinner}
            disabled={eligibleNominees.length === 0}
            className="mt-5 w-full rounded-full bg-yellow-300 px-5 py-4 text-sm font-black uppercase tracking-wide text-slate-950 shadow-[0_6px_0_#ca8a04] transition hover:-translate-y-0.5 hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {winner ? "Pick another nominee" : "Pick random nominee"}
          </button>
          {eligibleNominees.length === 0 ? (
            <p className="mt-3 text-center text-xs font-bold text-rose-300">Select at least one nominee first.</p>
          ) : null}
        </div>

        {winner ? (
          <div className="mt-4 rounded-3xl border-4 border-yellow-300 bg-white p-6 shadow-xl" aria-live="assertive">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-600">Selected nominee</p>
            <h2 className="mt-3 text-3xl font-black text-slate-950">{winner.childName}</h2>
            <p className="mt-2 text-sm font-bold text-slate-500">{winner.partyChoice}</p>
            <p className="mt-4 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-700">{winner.reason}</p>
          </div>
        ) : null}

        <p className="mt-4 px-2 text-xs font-semibold leading-relaxed text-slate-500">
          This tool does not publish or save a winner. It only displays the result in this browser so you can review it first.
        </p>
      </aside>
    </div>
  );
}
