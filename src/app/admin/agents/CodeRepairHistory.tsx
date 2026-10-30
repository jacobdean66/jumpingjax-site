import type { CodeRepairItem } from "@/lib/agent-manager/code-repair";
import { formatAgentTime } from "./time";

const STATUS_LABELS: Record<CodeRepairItem["status"], string> = {
  queued: "Waiting to start",
  running: "Preparing your fix",
  review_ready: "Ready for your review",
  failed: "Could not finish",
  cancelled: "Cancelled",
};

export function CodeRepairHistory({ repairs, onCancel }: { repairs: CodeRepairItem[]; onCancel: (id: string) => void }) {
  return <div className="mt-6 space-y-3" aria-label="Code repair history">
    {repairs.length === 0 ? <p className="text-sm text-slate-500">No repair requests yet.</p> : repairs.map(repair => <article key={repair.id} className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">Website repair</h3><span className="text-sm font-bold">{STATUS_LABELS[repair.status]}</span></div>
      <p className="mt-1 text-sm text-slate-500">{repair.page_path} · {formatAgentTime(repair.created_at)}</p>
      {repair.result ? <p className="mt-3 text-base leading-7">{repair.result.summary}</p> : null}
      {repair.status === "review_ready" && repair.result?.browserReviewRequired ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">Owner preview required: automated code checks passed, but the signed-in page, print output and relevant business behavior must be checked before merging.</p> : null}
      {repair.result?.pullRequestUrl ? <a href={repair.result.pullRequestUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-bold text-indigo-800 underline">Review this fix →</a> : null}
      <details className="mt-4 text-sm text-slate-600">
        <summary className="cursor-pointer font-semibold">Request details</summary>
        <p className="mt-2 whitespace-pre-wrap break-words leading-6">{repair.description}</p>
        {repair.run_url ? <a href={repair.run_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block underline">Test results</a> : null}
      </details>
      {["queued", "running"].includes(repair.status) ? <button type="button" onClick={() => onCancel(repair.id)} className="mt-3 text-sm font-bold text-rose-800 underline">Cancel repair</button> : null}
    </article>)}
  </div>;
}
