"use client";

import { useEffect, useState } from "react";

const endpoint = "/api/admin/agents/qwen-pilot";
type JobStatus = "queued" | "running" | "cancelling" | "cancelled" | "succeeded" | "failed";
type Job = {
  id: string;
  status: JobStatus;
  model: string | null;
  failure: "worker_lost" | "model_unavailable" | "unexpected_reply" | null;
};
type Snapshot = { online: boolean; jobs: Job[] };

const labels: Record<JobStatus, string> = {
  queued: "Waiting for the laptop",
  running: "Checking the local model",
  cancelling: "Stopping",
  cancelled: "Stopped",
  succeeded: "Connection check passed",
  failed: "Connection check failed",
};
const failures = {
  worker_lost: "The laptop stopped responding during the check.",
  model_unavailable: "The laptop could not get a reply from Ollama.",
  unexpected_reply: "The local model returned the wrong test code.",
};

export function QwenPilot() {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [readError, setReadError] = useState(false);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (busy) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const response = await fetch(endpoint, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Status unavailable");
        const data: Snapshot = await response.json();
        if (!controller.signal.aborted) {
          setSnapshot(data);
          setReadError(false);
        }
      } catch {
        if (!controller.signal.aborted) setReadError(true);
      }
      if (!controller.signal.aborted) timer = setTimeout(refresh, 8_000);
    };
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [busy]);

  async function submit(jobId?: string) {
    setBusy(true);
    setActionError("");
    try {
      const response = await fetch(endpoint, {
        method: jobId ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(jobId ? { jobId } : { requestId: crypto.randomUUID() }),
      });
      if (!response.ok) throw new Error("Request failed");
    } catch {
      setActionError(jobId ? "Could not confirm the stop." : "Could not confirm the connection check was queued.");
    } finally {
      setBusy(false);
    }
  }

  const latest = snapshot?.jobs[0];
  const canStop = latest?.status === "queued" || latest?.status === "running";
  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4" aria-labelledby="qwen-pilot-title">
      <h2 id="qwen-pilot-title" className="text-lg font-black">Local Qwen pilot</h2>
      <p className="mt-1 text-sm text-slate-700">Check whether the laptop can answer a short test prompt. The check uses a generated code.</p>
      <p className="mt-3 text-sm font-semibold" role="status">
        {readError ? "Could not read laptop status." : snapshot ? (snapshot.online ? "Laptop connected" : "Laptop offline") : "Checking laptop connection…"}
      </p>
      {latest && (
        <p className="mt-1 text-sm text-slate-700">
          {labels[latest.status]}{latest.model ? ` (${latest.model})` : ""}{latest.failure ? `. ${failures[latest.failure]}` : ""}
        </p>
      )}
      {actionError && <p className="mt-1 text-sm text-red-800" role="alert">{actionError}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy || !snapshot || readError || canStop || latest?.status === "cancelling"}
          onClick={() => void submit()} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
          Queue connection check
        </button>
        {canStop && <button type="button" disabled={busy} onClick={() => void submit(latest.id)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold disabled:opacity-50">
          Stop check
        </button>}
      </div>
    </section>
  );
}
