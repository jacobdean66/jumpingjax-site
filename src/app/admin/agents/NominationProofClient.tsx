"use client";

import { useEffect, useState } from "react";

type NominationRun = {
  id: string;
  status: string;
  isCompleted: boolean;
  isSuccess: boolean;
  isFailed: boolean;
  finishedAt: string | null;
  output: {
    sourceEventId: string;
    nominationId: string;
    nominee: string;
    stored: true;
    created: boolean;
    attempt: number;
    handler: string;
    aiInvocations: 0;
  } | null;
  error: string | null;
};

export function NominationProofClient() {
  const [run, setRun] = useState<NominationRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    const response = await fetch("/api/admin/agents/nomination-proof", { cache: "no-store" });
    const body = await response.json();
    if (response.ok) setRun(body.run);
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/agents/nomination-proof", { cache: "no-store" })
      .then((response) => response.json().then((body) => ({ response, body })))
      .then(({ response, body }) => {
        if (active && response.ok) setRun(body.run);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!run || run.isCompleted) return;
    const timer = window.setInterval(() => void refresh(), 1_500);
    return () => window.clearInterval(timer);
  }, [run]);

  async function start(proveDuplicate: boolean) {
    setBusy(true);
    setMessage("");
    try {
      const sourceEventId = `jj-fixture-${Date.now()}`;
      const request = () => fetch("/api/admin/agents/nomination-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceEventId }),
      });
      const first = await request();
      const firstBody = await first.json();
      if (!first.ok) throw new Error(firstBody.error);
      if (proveDuplicate) {
        const second = await request();
        const secondBody = await second.json();
        if (!second.ok) throw new Error(secondBody.error);
        setMessage(firstBody.runId === secondBody.runId
          ? `Deduplication PASS — source event returned the same run ${firstBody.runId}.`
          : "Deduplication FAIL — source event returned different runs.");
      } else {
        setMessage("Safe structured nomination fixture started; no AI is used.");
      }
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nomination fixture failed safely.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-7 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Nomination Agent · safe fixture</p>
          <h2 className="mt-1 text-2xl font-black">{run?.status ?? "No run yet"}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-700">Structured email rules · AI calls {run?.output?.aiInvocations ?? 0}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} onClick={() => start(false)} className="rounded-full bg-emerald-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50">Process fixture</button>
          <button disabled={busy} onClick={() => start(true)} className="rounded-full bg-teal-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50">Prove source dedupe</button>
        </div>
      </div>
      {message ? <p role="status" className="mt-3 rounded-xl bg-white p-3 text-sm font-bold">{message}</p> : null}
      {run ? (
        <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-4">
          <div><dt className="font-black text-slate-500">Run</dt><dd className="break-all font-semibold">{run.id}</dd></div>
          <div><dt className="font-black text-slate-500">Result</dt><dd className="font-semibold">{run.isSuccess ? "STORED" : run.isFailed ? "FAILED" : "IN PROGRESS"}</dd></div>
          <div><dt className="font-black text-slate-500">Nominee</dt><dd className="font-semibold">{run.output?.nominee ?? "—"}</dd></div>
          <div><dt className="font-black text-slate-500">Source event</dt><dd className="break-all font-semibold">{run.output?.sourceEventId ?? "—"}</dd></div>
        </dl>
      ) : null}
    </section>
  );
}
