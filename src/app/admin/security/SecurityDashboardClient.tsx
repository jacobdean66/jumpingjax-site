"use client";

import { useState } from "react";
import type { SecurityDashboardSnapshot, SecurityServiceSnapshot } from "@/lib/security/types";

type ActionState = { service: string; message: string; ok: boolean } | null;

const stateTone: Record<SecurityServiceSnapshot["state"], string> = {
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-950",
  degraded: "border-amber-200 bg-amber-50 text-amber-950",
  failing: "border-rose-200 bg-rose-50 text-rose-950",
  unavailable: "border-slate-300 bg-slate-100 text-slate-800",
  misconfigured: "border-violet-200 bg-violet-50 text-violet-950",
};

const stateLabel: Record<SecurityServiceSnapshot["state"], string> = {
  healthy: "Verified",
  degraded: "Needs check",
  failing: "Attention",
  unavailable: "Unavailable",
  misconfigured: "Setup needed",
};

export function SecurityDashboardClient({ initial }: { initial: SecurityDashboardSnapshot }) {
  const [dashboard, setDashboard] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [action, setAction] = useState<ActionState>(null);

  async function loadDashboard() {
    const response = await fetch("/api/admin/security/status", { credentials: "same-origin", cache: "no-store" });
    const body = (await response.json()) as { dashboard?: SecurityDashboardSnapshot; error?: string };
    if (!response.ok || !body.dashboard) throw new Error(body.error || "Status refresh failed.");
    setDashboard(body.dashboard);
    return body.dashboard;
  }

  async function refresh() {
    setBusy("refresh");
    setAction(null);
    try {
      await loadDashboard();
      setAction({ service: "all", ok: true, message: "Security results refreshed." });
    } catch (error) {
      setAction({ service: "all", ok: false, message: error instanceof Error ? error.message : "Status refresh failed." });
    } finally {
      setBusy(null);
    }
  }

  async function runAction(kind: "scan" | "health") {
    setBusy(kind);
    setAction(null);
    try {
      const response = await fetch(`/api/admin/security/${kind}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = (await response.json()) as { result?: { message?: string; scanId?: number }; correlationId?: string; error?: string };
      const message = body.result?.message || body.error || `${kind} request failed.`;
      setAction({ service: kind === "scan" ? "aikido" : "aithura", ok: response.ok, message });
      if (kind === "health" && response.ok) await loadDashboard();
      if (kind === "scan" && response.ok && body.result?.scanId && body.correlationId) {
        await loadDashboard();
        await pollScan(body.result.scanId, body.correlationId);
      }
    } catch {
      setAction({ service: kind === "scan" ? "aikido" : "aithura", ok: false, message: `${kind} request failed.` });
    } finally {
      setBusy(null);
    }
  }

  async function pollScan(scanId: number, correlationId: string) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 5_000));
      const response = await fetch("/api/admin/security/scan-status", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId, correlationId }),
      });
      const body = (await response.json()) as { result?: { completed?: boolean; passed?: boolean | null; message?: string }; error?: string };
      if (!response.ok) {
        setAction({ service: "aikido", ok: false, message: body.error || "Scan status check failed." });
        return;
      }
      if (body.result?.completed) {
        const completedAction = { service: "aikido", ok: body.result.passed === true, message: body.result.message || "Scan completed." };
        await loadDashboard();
        setAction(completedAction);
        return;
      }
      setAction({ service: "aikido", ok: true, message: body.result?.message || "Aikido scan is still running." });
    }
    setAction({ service: "aikido", ok: true, message: `Aikido scan ${scanId} is still running. Use Resume scan to continue checking it.` });
  }

  const aithura = dashboard.services.find((service) => service.id === "aithura");

  return (
    <div className="mt-7 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Last refreshed {new Date(dashboard.generatedAt).toLocaleString()}</p>
        <button type="button" onClick={refresh} disabled={busy !== null} className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
          {busy === "refresh" ? "Refreshing…" : "Refresh security results"}
        </button>
      </div>

      {action ? <div role="status" className={`rounded-2xl border p-4 text-sm font-bold ${action.ok ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-rose-200 bg-rose-50 text-rose-950"}`}>{action.message}</div> : null}

      <section aria-label="Security overview" className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Latest repository scan</p>
          <p className="mt-2 text-xl font-black capitalize text-slate-950">{dashboard.latestScan.state === "not_run" ? "Aikido managed" : dashboard.latestScan.state.replace("_", " ")}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{dashboard.latestScan.issueCount === null ? "No recorded finding count" : `${dashboard.latestScan.issueCount} finding${dashboard.latestScan.issueCount === 1 ? "" : "s"}`}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Protected AI route</p>
          <p className="mt-2 text-xl font-black text-slate-950">{stateLabel[aithura?.state || "unavailable"]}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">AITHURA Sentinel</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Repair readiness</p>
          <p className="mt-2 text-xl font-black capitalize text-slate-950">{dashboard.repair.state.replaceAll("_", " ")}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Owner-reviewed changes only</p>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        {dashboard.services.map((service) => (
          <article key={service.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">Service</p><h2 className="mt-2 text-2xl font-black">{service.name}</h2></div>
              <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${stateTone[service.state]}`}>{stateLabel[service.state]}</span>
            </div>
            <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-600">{service.summary}</p>
            <dl className="mt-5 grid gap-3 sm:grid-cols-3">
              {service.metrics.map((metric) => <div key={metric.label} className="rounded-2xl bg-slate-50 p-3"><dt className="text-[11px] font-black uppercase tracking-wide text-slate-500">{metric.label}</dt><dd className="mt-1 text-sm font-black text-slate-950">{metric.value}</dd></div>)}
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              {service.dashboardUrl ? <a href={service.dashboardUrl} target="_blank" rel="noreferrer" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-black text-slate-800 hover:bg-slate-50">Open {service.name}</a> : null}
              {service.id === "aikido" ? (
                <>
                  {service.capabilities.scan.available ? <button type="button" disabled={busy !== null || Boolean(dashboard.pendingScan)} onClick={() => runAction("scan")} className="rounded-full bg-sky-600 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">{busy === "scan" ? "Starting…" : "Run production repository scan"}</button> : null}
                  {dashboard.pendingScan ? <button type="button" disabled={busy !== null} onClick={() => pollScan(dashboard.pendingScan!.scanId, dashboard.pendingScan!.correlationId)} className="rounded-full border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-black text-sky-900 disabled:opacity-50">Resume scan {dashboard.pendingScan.scanId}</button> : null}
                </>
              ) : (
                <button type="button" disabled={!service.capabilities.healthCheck.available || busy !== null} title={service.capabilities.healthCheck.reason} onClick={() => runAction("health")} className="rounded-full bg-sky-600 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                  {busy === "health" ? "Testing…" : "Verify protected AI route"}
                </button>
              )}
            </div>
            {!service.capabilities.scan.available && service.id === "aikido" ? <p className="mt-3 text-xs font-semibold leading-relaxed text-slate-500">{service.capabilities.scan.reason}</p> : null}
          </article>
        ))}
      </section>

      <section className={`rounded-3xl border p-5 ${dashboard.repair.state === "no_findings" ? "border-emerald-200 bg-emerald-50" : dashboard.repair.state === "findings_ready" ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">Safe repair loop</p>
        <h2 className="mt-2 text-2xl font-black text-slate-950">{dashboard.repair.state === "no_findings" ? "No fixes needed" : dashboard.repair.state === "findings_ready" ? "Findings ready for review" : "Scan before preparing fixes"}</h2>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-relaxed text-slate-800">{dashboard.repair.summary}</p>
        <ol className="mt-4 grid gap-2 text-sm font-semibold text-slate-800 md:grid-cols-2">
          {dashboard.repair.steps.map((step, index) => <li key={step} className="rounded-2xl border border-slate-200 bg-white/70 p-3"><span className="mr-2 font-black">{index + 1}.</span>{step}</li>)}
        </ol>
        {dashboard.repair.actionUrl ? <a href={dashboard.repair.actionUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800">{dashboard.repair.actionLabel}</a> : <button type="button" disabled className="mt-4 rounded-full bg-slate-300 px-4 py-2 text-sm font-black text-slate-600 cursor-not-allowed">{dashboard.repair.actionLabel}</button>}
        <p className="mt-2 text-xs font-semibold text-slate-700">AutoFix opens in Aikido for review. This page never merges or deploys automatically.</p>
      </section>
    </div>
  );
}
