"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { SupervisorIssue } from "@/lib/agent-manager/supervisor";
import { findingExplanationSchema, isFindingExplanationQuestion, techSearchReportSchema, type FindingExplanation, type TechSearchReport } from "@/lib/agent-manager/tech-search";
import { formatAgentTime } from "./time";

export function FindingExplanationView({ explanation }: { explanation: FindingExplanation }) {
  return <aside aria-label="Finding explanation" className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-slate-800">
    <h3 className="font-black text-slate-950">What this finding means</h3>
    <p className="mt-2 font-bold">{explanation.summary}</p>
    <p className="mt-2 leading-6">{explanation.meaning}</p>
    <ol className="mt-3 list-decimal space-y-2 pl-5">{explanation.nextSteps.map(step => <li key={step}>{step}</li>)}</ol>
    <a href={explanation.href} className="mt-3 inline-block min-h-11 rounded-xl bg-slate-950 px-4 py-3 font-black text-white">Open related workspace</a>
    <p className="mt-2 text-xs text-slate-500">Based on the dashboard check at {formatAgentTime(explanation.checkedAt)}. No AI search was used.</p>
  </aside>;
}

export function ResearchReport({ report }: { report: TechSearchReport }) {
  const parts: ReactNode[] = [];
  let position = 0;
  report.citations.forEach((citation, index) => {
    parts.push(report.answer.slice(position, citation.start));
    parts.push(<a key={`${citation.start}-${index}`} href={citation.url} target="_blank" rel="noopener noreferrer" title={citation.title} className="font-black text-sky-700 underline">[{index + 1}]</a>);
    position = citation.end;
  });
  parts.push(report.answer.slice(position));
  const sources = [...new Map(report.citations.map(c => [c.url, c])).values()];
  return <article className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
    <h3 className="font-black text-slate-950">{report.question}</h3>
    <p className="mt-1 text-xs font-semibold text-slate-500">Researched {formatAgentTime(report.searchedAt)} · Website check {formatAgentTime(report.snapshotAt)}</p>
    {report.issueCode ? <p className="mt-1 break-words text-xs text-slate-500">Finding: {report.issueCode}</p> : null}
    <div className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">{parts}</div>
    <h4 className="mt-4 text-sm font-black">Sources</h4>
    <ul className="mt-2 space-y-2 text-sm">{sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="break-words font-bold text-sky-700 underline">{source.title}</a><span className="ml-2 text-xs text-slate-500">{new URL(source.url).hostname}</span></li>)}</ul>
  </article>;
}

export function TechSearchClient({ issues, initialIssueCode }: { issues: SupervisorIssue[]; initialIssueCode?: string }) {
  const [issueCode, setIssueCode] = useState(issues.some(i => i.code === initialIssueCode) ? initialIssueCode! : "");
  const [question, setQuestion] = useState(initialIssueCode ? "What could cause this finding, and what should we check next?" : "");
  const [reports, setReports] = useState<TechSearchReport[]>([]);
  const [busy, setBusy] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState<FindingExplanation | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const inFlight = useRef(false);
  const request = useRef<{ fingerprint: string; id: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin/agents/tech-search", { cache: "no-store", signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!response.ok || !Array.isArray(body.reports)) throw new Error("Saved research could not be loaded.");
      const saved = body.reports.map((raw: unknown) => techSearchReportSchema.parse(raw));
      setReports(current => [...new Map([...current, ...saved].map(report => [report.id, report])).values()].slice(0, 12));
    }).catch(() => { if (!controller.signal.aborted) setHistoryError("Saved research could not be loaded. Refresh to try again."); })
      .finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    return () => controller.abort();
  }, []);

  async function submit(event?: FormEvent<HTMLFormElement>, explain = false) {
    event?.preventDefault();
    const submittedQuestion = explain ? "Explain this finding" : question.trim();
    if (inFlight.current || submittedQuestion.length < 5) return;
    inFlight.current = true;
    setBusy(true); setError(""); setExplanation(null);
    setExplaining(Boolean(issueCode && isFindingExplanationQuestion(submittedQuestion)));
    const fingerprint = JSON.stringify([submittedQuestion, issueCode]);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
    try {
      const response = await fetch("/api/admin/agents/tech-search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: submittedQuestion, ...(issueCode ? { issueCode } : {}), requestId: request.current!.id }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) {
        if (body.failureCode) request.current = null;
        throw new Error(body.error || "Tech Search could not complete.");
      }
      if (body.explanation) { setExplanation(findingExplanationSchema.parse(body.explanation)); return; }
      const report = techSearchReportSchema.parse(body.report);
      setReports(current => [report, ...current.filter(item => item.id !== report.id)].slice(0, 12));
      window.dispatchEvent(new Event("agent-manager:refresh"));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Tech Search could not complete."); }
    finally { inFlight.current = false; setBusy(false); }
  }

  return <section className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5">
    <h2 className="text-2xl font-black text-slate-950">Tech Search</h2>
    <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-600">Choose a finding to get a plain-language explanation, or ask a technical question to research current official documentation. Web research includes cited sources and saved reports.</p>
    <form onSubmit={event => void submit(event)} className="mt-4 grid gap-3">
      <label className="text-sm font-bold">Related finding
        <select disabled={busy} value={issueCode} onChange={event => { setIssueCode(event.target.value); setExplanation(null); setError(""); }} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-950">
          <option value="">General technical question</option>
          {issues.map(issue => <option key={issue.code} value={issue.code}>{issue.severity}: {issue.summary.slice(0, 160)}</option>)}
        </select>
      </label>
      <label className="text-sm font-bold" htmlFor="tech-search-question">What should we investigate?</label>
      <textarea id="tech-search-question" value={question} disabled={busy} onChange={event => setQuestion(event.target.value)} minLength={5} maxLength={600} required rows={3} placeholder="For example: Which checks help diagnose delayed booking confirmation emails?" className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-950" />
      <p className="text-xs font-semibold text-slate-500">Leave out customer information, passwords, and tokens. Explain finding uses the current dashboard check. Web research uses the existing AI account.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy || question.trim().length < 5} className="min-h-11 rounded-xl bg-slate-950 px-5 py-2 text-sm font-black text-white disabled:opacity-50">{busy ? explaining ? "Explaining…" : "Researching…" : issueCode && isFindingExplanationQuestion(question) ? "Explain this finding" : "Search official sources"}</button>
        <button type="button" disabled={busy || !issueCode} onClick={() => void submit(undefined, true)} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-50">Explain finding</button>
        <button type="button" disabled={busy} onClick={() => { request.current = null; setQuestion(""); setIssueCode(""); setError(""); setExplanation(null); }} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-50">New search</button>
      </div>
    </form>
    {busy ? <p role="status" className="mt-3 text-sm font-semibold">{explaining ? "Checking the selected finding…" : "Searching and preparing a cited report. This may take up to a minute."}</p> : null}
    {error ? <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-900">{error}</p> : null}
    {explanation ? <FindingExplanationView explanation={explanation} /> : null}
    <h3 className="mt-6 text-lg font-black">Saved research</h3>
    {historyLoading ? <p className="mt-2 text-sm text-slate-500">Loading saved research…</p> : null}
    {historyError ? <p role="alert" className="mt-2 text-sm text-rose-800">{historyError}</p> : null}
    {!historyLoading && !historyError && !reports.length ? <p className="mt-2 text-sm text-slate-500">No saved research yet.</p> : null}
    {reports.map(report => <ResearchReport key={report.id} report={report} />)}
  </section>;
}
