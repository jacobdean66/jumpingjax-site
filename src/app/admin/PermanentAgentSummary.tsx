"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UNKNOWN_AGENT_SUMMARY, type AgentNavigationSummary } from "@/lib/agent-manager/navigation-summary";

export function PermanentAgentSummary({ variant = "standard" }: { variant?: "standard" | "home" | "route" }) {
  const [summary, setSummary] = useState<AgentNavigationSummary>(UNKNOWN_AGENT_SUMMARY);
  const [stale, setStale] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch("/api/admin/agents/summary", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const next = await response.json() as AgentNavigationSummary;
        setSummary(next);
        setStale(Boolean(next.checkedAt && Date.now() - Date.parse(next.checkedAt) > 15 * 60_000));
      } catch { /* Keep the truthful unknown state when the summary is unavailable. */ }
    }
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => { controller.abort(); window.removeEventListener("focus", onFocus); };
  }, []);
  const surface = variant === "home" ? "ah-panel ah-focus-detail" : variant === "route" ? "rp-panel rp-task-meta" : "rounded-xl border border-slate-200 bg-white text-slate-700";
  return <aside aria-label="Permanent Agent status" className={`${surface} mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-xs`}>
    <Link href="/admin/agents#supervisor" className="font-black underline underline-offset-2">Permanent Agent</Link>
    {summary.checkedAt ? <>
      <Link href="/admin/agents#supervisor" className="font-semibold">{summary.critical ?? "Unknown"} critical · {summary.warnings ?? "Unknown"} {summary.warnings === 1 ? "warning" : "warnings"}</Link>
      {summary.approvals !== null ? <Link href="/admin/agents#agent-controls">{summary.approvals} awaiting review</Link> : null}
      {summary.coverage ? <span>{summary.coverage.checked}/{summary.coverage.total} services connected</span> : null}
      <span>Last checked: {new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(summary.checkedAt))}{stale ? " · Check is older than 15 minutes" : ""}</span>
    </> : <span>Check status unavailable · Open the agent for current details</span>}
  </aside>;
}
