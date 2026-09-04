"use client";

import { useMemo, useState } from "react";

import { pickSecureRandomIndex } from "@/lib/giveaway/public-nominee-display";

export type GiveawayDrawSubmission = {
  id: string;
  reason: string;
  nominatorName: string;
  nominatorEmail: string;
  createdAt: string;
};

export type GiveawayDrawGroup = {
  groupKey: string;
  childName: string;
  birthday: string;
  partyChoice: string;
  nominationCount: number;
  isWinner: boolean;
  freePassRedeemed: boolean;
  submissions: GiveawayDrawSubmission[];
};

function formatSubmittedAt(value: string) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function GiveawayDrawClient({
  groups,
  submissionCount,
  uniqueChildCount,
}: {
  groups: GiveawayDrawGroup[];
  submissionCount: number;
  uniqueChildCount: number;
}) {
  const [eligibleKeys, setEligibleKeys] = useState(
    () => new Set(groups.map((group) => group.groupKey)),
  );
  const [winnerKey, setWinnerKey] = useState<string | null>(
    () => groups.find((group) => group.isWinner)?.groupKey ?? null,
  );
  const [redeemedKeys, setRedeemedKeys] = useState(
    () => new Set(groups.filter((group) => group.freePassRedeemed).map((group) => group.groupKey)),
  );
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [statusError, setStatusError] = useState("");

  const eligibleGroups = useMemo(
    () => groups.filter((group) => eligibleKeys.has(group.groupKey)),
    [eligibleKeys, groups],
  );
  const winner = groups.find((group) => group.groupKey === winnerKey) ?? null;

  function toggleGroup(groupKey: string) {
    setWinnerKey(null);
    setEligibleKeys((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }

  function drawWinner() {
    if (eligibleGroups.length === 0) return;
    setWinnerKey(eligibleGroups[pickSecureRandomIndex(eligibleGroups.length)].groupKey);
  }

  async function saveStatus(
    group: GiveawayDrawGroup,
    action: "winner" | "free_pass_redeemed",
    value?: boolean,
  ) {
    setSavingKey(group.groupKey);
    setStatusError("");
    try {
      const response = await fetch("/api/admin/giveaway/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, groupKey: group.groupKey, childName: group.childName, value }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "The giveaway status could not be saved.");

      if (action === "winner") {
        setWinnerKey(group.groupKey);
        setRedeemedKeys((current) => {
          const next = new Set(current);
          next.delete(group.groupKey);
          return next;
        });
      } else {
        setRedeemedKeys((current) => {
          const next = new Set(current);
          if (value) next.add(group.groupKey);
          else next.delete(group.groupKey);
          return next;
        });
      }
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "The giveaway status could not be saved.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <p className="text-sm font-black text-slate-950">
              {eligibleGroups.length} of {uniqueChildCount} unique children in this draw
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {submissionCount} total submissions · each child gets one chance, even with multiple nominations
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setWinnerKey(null);
                setEligibleKeys(new Set(groups.map((group) => group.groupKey)));
              }}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
            >
              Include all
            </button>
            <button
              type="button"
              onClick={() => {
                setWinnerKey(null);
                setEligibleKeys(new Set());
              }}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
            >
              Clear shortlist
            </button>
          </div>
        </div>

        {groups.map((group) => {
          const included = eligibleKeys.has(group.groupKey);
          return (
            <article
              key={group.groupKey}
              className={`block rounded-2xl border-2 bg-white p-5 shadow-sm transition ${
                winnerKey === group.groupKey
                  ? "border-yellow-400 ring-2 ring-yellow-100"
                  : included
                    ? "border-sky-400 ring-2 ring-sky-100"
                    : "border-slate-200 opacity-65 hover:opacity-100"
              }`}
            >
              <div className="flex items-start gap-4">
                <label className="mt-1 flex shrink-0 cursor-pointer items-center gap-2 text-xs font-black text-slate-600">
                  <input
                    type="checkbox"
                    checked={included}
                    onChange={() => toggleGroup(group.groupKey)}
                    className="h-5 w-5 accent-sky-600"
                  />
                  Draw
                </label>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-xl font-black text-slate-950">{group.childName}</h2>
                    <div className="flex flex-wrap gap-2">
                      {winnerKey === group.groupKey ? (
                        <span className="rounded-full bg-yellow-300 px-3 py-1 text-xs font-black text-slate-950">
                          Winner
                        </span>
                      ) : null}
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                        {group.partyChoice}
                      </span>
                      <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-black text-sky-800">
                        {group.nominationCount}{" "}
                        {group.nominationCount === 1 ? "nomination" : "nominations"}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Birthday {group.birthday}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                    {winnerKey === group.groupKey ? (
                      <p className="text-sm font-black text-amber-700">Marked as the giveaway winner</p>
                    ) : (
                      <label
                        className={`flex cursor-pointer items-center gap-2 text-sm font-black ${
                          redeemedKeys.has(group.groupKey) ? "text-emerald-700" : "text-slate-800"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={redeemedKeys.has(group.groupKey)}
                          disabled={savingKey === group.groupKey}
                          onChange={(event) => saveStatus(group, "free_pass_redeemed", event.target.checked)}
                          className="h-5 w-5 accent-emerald-600"
                        />
                        {redeemedKeys.has(group.groupKey)
                          ? "Child has used the free pass"
                          : "Mark free pass as used"}
                      </label>
                    )}
                    {winnerKey !== group.groupKey ? (
                      <button
                        type="button"
                        disabled={savingKey === group.groupKey}
                        onClick={() => saveStatus(group, "winner")}
                        className="rounded-full border border-yellow-400 bg-yellow-50 px-3 py-2 text-xs font-black text-amber-900 hover:bg-yellow-100 disabled:opacity-50"
                      >
                        {savingKey === group.groupKey ? "Saving…" : "Mark as winner"}
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-4 space-y-4">
                    {group.submissions.map((submission) => (
                      <div
                        key={submission.id}
                        className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                      >
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Nominated by {submission.nominatorName} · {submission.nominatorEmail} ·{" "}
                          {formatSubmittedAt(submission.createdAt)}
                        </p>
                        <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-700">
                          {submission.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
        {statusError ? (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">
            {statusError}
          </p>
        ) : null}
      </section>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-300">Winner picker</p>
          <h2 className="mt-3 text-2xl font-black">Random draw</h2>
          <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-300">
            Every checked child has exactly the same chance. Duplicate nominations do not create extra odds.
          </p>
          <button
            type="button"
            onClick={drawWinner}
            disabled={eligibleGroups.length === 0}
            className="mt-5 w-full rounded-full bg-yellow-300 px-5 py-4 text-sm font-black uppercase tracking-wide text-slate-950 shadow-[0_6px_0_#ca8a04] transition hover:-translate-y-0.5 hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {winner ? "Pick another child" : "Pick random child"}
          </button>
          {eligibleGroups.length === 0 ? (
            <p className="mt-3 text-center text-xs font-bold text-rose-300">Select at least one child first.</p>
          ) : null}
        </div>

        {winner ? (
          <div className="mt-4 rounded-3xl border-4 border-yellow-300 bg-white p-6 shadow-xl" aria-live="assertive">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-600">Selected child</p>
            <h2 className="mt-3 text-3xl font-black text-slate-950">{winner.childName}</h2>
            <p className="mt-2 text-sm font-bold text-slate-500">{winner.partyChoice}</p>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              {winner.nominationCount} nomination {winner.nominationCount === 1 ? "story" : "stories"}
            </p>
            <div className="mt-4 space-y-3">
              {winner.submissions.map((submission) => (
                <p
                  key={submission.id}
                  className="whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-700"
                >
                  {submission.reason}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        <p className="mt-4 px-2 text-xs font-semibold leading-relaxed text-slate-500">
          Random picks are previews. Use “Mark as winner” on a child’s card to save the official winner.
        </p>
      </aside>
    </div>
  );
}
