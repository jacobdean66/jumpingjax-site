"use client";

import { useState } from "react";

type Review = {
  totalIssues: number;
  totalBookings: number;
  actionCounts: Record<string, number>;
  groups: Array<{
    reference: string;
    bookingKind: "rental" | "facility";
    steps: string[];
    outcomes: string[];
    jobStatuses: string[];
    issueCount: number;
    latestWorkflowUpdate: string;
  }>;
  truncated: boolean;
  aiInvocations: 0;
  replayedActions: 0;
};

const STEP_LABELS: Record<string, string> = {
  initial_customer_email: "Initial customer email",
  owner_notification: "Owner notification",
  decision_email: "Decision email",
  calendar: "Calendar",
};

export function BookingTriageReviewClient() {
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/agents/booking-triage-review", { cache: "no-store" });
      const body = await response.json() as { ok: boolean; result?: Review; error?: string };
      if (!response.ok || !body.result) throw new Error(body.error ?? "Review could not be loaded safely.");
      setReview(body.result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Review could not be loaded safely.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-violet-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black">Classified issue review</h3>
          <p className="mt-1 text-xs font-semibold text-slate-600">Grouped, redacted preparation only. Loading this view cannot replay email or calendar actions.</p>
        </div>
        <button disabled={busy} onClick={load} className="rounded-full border border-violet-300 px-4 py-2 text-sm font-black text-violet-900 disabled:opacity-50">
          {busy ? "Loading…" : review ? "Refresh grouped review" : "Open grouped review"}
        </button>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm font-bold text-red-800">{error}</p> : null}
      {review ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-xl bg-violet-50 p-3"><p className="font-black text-violet-700">Issues</p><p className="text-xl font-black">{review.totalIssues}</p></div>
            <div className="rounded-xl bg-violet-50 p-3"><p className="font-black text-violet-700">Bookings</p><p className="text-xl font-black">{review.totalBookings}</p></div>
            <div className="rounded-xl bg-emerald-50 p-3"><p className="font-black text-emerald-700">Actions replayed</p><p className="text-xl font-black">{review.replayedActions}</p></div>
            <div className="rounded-xl bg-emerald-50 p-3"><p className="font-black text-emerald-700">AI calls</p><p className="text-xl font-black">{review.aiInvocations}</p></div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-700">
            {Object.entries(review.actionCounts).map(([step, count]) => <span key={step} className="rounded-full bg-slate-100 px-3 py-1">{STEP_LABELS[step] ?? step}: {count}</span>)}
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700"><tr><th className="p-2">Reference</th><th className="p-2">Type</th><th className="p-2">Steps</th><th className="p-2">Outcome</th><th className="p-2">Ledger</th></tr></thead>
              <tbody>{review.groups.map((group) => (
                <tr key={group.reference} className="border-t border-slate-100">
                  <td className="p-2 font-mono font-bold">{group.reference}</td>
                  <td className="p-2 font-semibold">{group.bookingKind}</td>
                  <td className="p-2 font-semibold">{group.steps.map((step) => STEP_LABELS[step] ?? step).join(", ")}</td>
                  <td className="p-2 font-semibold">{group.outcomes.join(", ")} · {group.issueCount}</td>
                  <td className="p-2 font-semibold">{group.jobStatuses.join(", ") || "unknown"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {review.truncated ? <p className="text-xs font-bold text-amber-800">Showing the newest 50 grouped bookings from the bounded 200-job review.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
