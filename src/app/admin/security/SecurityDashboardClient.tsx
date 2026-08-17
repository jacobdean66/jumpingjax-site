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

export function SecurityDashboardClient({ initial }: { initial: SecurityDashboardSnapshot }) {
  const [dashboard, setDashboard] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [action, setAction] = useState<ActionState>(null);

  async function refresh() {
    setBusy("refresh");
    setAction(null);
    try {
      const response = await fetch("/api/admin/security/status", { credentials: "same-origin", cache: "no-store" });
      const body = (await response.json()) as { dashboard?: SecurityDashboardSnapshot; error?: string };
      if (!response.ok || !body.dashboard) throw new Error(body.error || "Status refresh failed.");
      setDashboard(body.dashboard);
      setAction({ service: "all", ok: true, message: "Saved observations and configuration refreshed." });
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
      if (kind === "scan" && response.ok && body.result?.scanId && body.correlationId) {
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
        await refresh();
        setAction(completedAction);
        return;
      }
      setAction({ service: "aikido", ok: true, message: body.result?.message || "Aikido scan is still running." });
    }
    setAction({ service: "aikido", ok: true, message: `Aikido scan ${scanId} is still running. Refresh observations later for the saved result.` });
  }

  return (
    <div className="mt-7 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          Last refreshed {new Date(dashboard.generatedAt).toLocaleString()}
        </p>
        <button type="button" onClick={refresh} disabled={busy !== null} className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
          {busy === "refresh" ? "Refreshing…" : "Refresh observations"}
        </button>
      </div>

      {action ? (
        <div role="status" className={`rounded-2xl border p-4 text-sm font-bold ${action.ok ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-rose-200 bg-rose-50 text-rose-950"}`}>
          {action.message}
        </div>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-2">
        {dashboard.services.map((service) => (
          <article key={service.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">Service</p>
                <h2 className="mt-2 text-2xl font-black">{service.name}</h2>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${stateTone[service.state]}`}>{service.state}</span>
            </div>
            <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-600">{service.summary}</p>
            <dl className="mt-5 grid gap-3 sm:grid-cols-3">
              {service.metrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl bg-slate-50 p-3">
                  <dt className="text-[11px] font-black uppercase tracking-wide text-slate-500">{metric.label}</dt>
                  <dd className="mt-1 text-sm font-black text-slate-950">{metric.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              {service.dashboardUrl ? <a href={service.dashboardUrl} target="_blank" rel="noreferrer" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-black text-slate-800 hover:bg-slate-50">Open {service.name}</a> : null}
              {service.id === "aikido" ? (
                <>
                  <button type="button" disabled={!service.capabilities.scan.available || busy !== null || Boolean(dashboard.pendingScan)} title={service.capabilities.scan.reason} onClick={() => runAction("scan")} className="rounded-full bg-sky-600 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                    {busy === "scan" ? "Starting…" : "Start feature-branch CI scan"}
                  </button>
                  {dashboard.pendingScan ? (
                    <button type="button" disabled={busy !== null} onClick={() => pollScan(dashboard.pendingScan!.scanId, dashboard.pendingScan!.correlationId)} className="rounded-full border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-black text-sky-900 disabled:opacity-50">
                      Resume scan {dashboard.pendingScan.scanId}
                    </button>
                  ) : null}
                </>
              ) : (
                <button type="button" disabled={!service.capabilities.healthCheck.available || busy !== null} title={service.capabilities.healthCheck.reason} onClick={() => runAction("health")} className="rounded-full bg-sky-600 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                  {busy === "health" ? "Testing…" : "Run live health test (1 AI request)"}
                </button>
              )}
            </div>
            {!service.capabilities.scan.available && service.id === "aikido" ? <p className="mt-3 text-xs font-semibold leading-relaxed text-slate-500">{service.capabilities.scan.reason}</p> : null}
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-800">Safe repair loop</p>
        <h2 className="mt-2 text-2xl font-black text-amber-950">Fixes stop for owner review</h2>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-relaxed text-amber-950">{dashboard.repair.summary}</p>
        <ol className="mt-4 grid gap-2 text-sm font-semibold text-amber-950 md:grid-cols-2">
          {dashboard.repair.steps.map((step, index) => <li key={step} className="rounded-2xl border border-amber-200 bg-white/70 p-3"><span className="mr-2 font-black">{index + 1}.</span>{step}</li>)}
        </ol>
        <button type="button" disabled title="A confirmed finding and a scoped GitHub pull-request connection are required." className="mt-4 rounded-full bg-slate-300 px-4 py-2 text-sm font-black text-slate-600 cursor-not-allowed">
          Prepare fix review
        </button>
        <p className="mt-2 text-xs font-semibold text-amber-900">Connect a scoped GitHub pull-request workflow before enabling this control. It will never merge or deploy automatically.</p>
      </section>
    </div>
  );
}
