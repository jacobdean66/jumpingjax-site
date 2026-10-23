"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { quickWritingSuggestions, safeWritingDraft, writingSuggestionOutput } from "@/lib/agent-manager/writing-suggestions";

export function SupervisorComposer({ message, busy, onChange, onSubmit }: {
  message: string; busy: boolean; onChange: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const lastRequestedAt = useRef(0);
  const selected = useRef("");
  const [generated, setGenerated] = useState<{ draft: string; suggestions: string[] } | null>(null);
  const [working, setWorking] = useState(false);
  const [composing, setComposing] = useState(false);
  const draft = message.trim();
  const suggestions = generated?.draft === draft ? generated.suggestions : quickWritingSuggestions(draft);

  useEffect(() => {
    if (busy || composing || draft === selected.current || draft.length < 4 || draft.length > 500 || !safeWritingDraft(draft)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      lastRequestedAt.current = Date.now();
      setWorking(true);
      void fetch("/api/admin/agents/writing-suggestions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }), signal: controller.signal,
      }).then(async response => {
        if (!response.ok) return;
        const body = await response.json();
        const parsed = writingSuggestionOutput.safeParse({ suggestions: body.suggestions });
        if (!controller.signal.aborted && body.ok && parsed.success) setGenerated({ draft, suggestions: parsed.data.suggestions });
      }).catch(() => { /* Quick suggestions remain available if generation is interrupted. */ })
        .finally(() => { if (!controller.signal.aborted) setWorking(false); });
    }, Math.max(900, lastRequestedAt.current + 5_000 - Date.now()));
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [draft, busy, composing]);

  function change(value: string) {
    setGenerated(null);
    setWorking(false);
    onChange(value);
  }

  return <form onSubmit={onSubmit} className="mt-4">
    <div className="flex flex-col gap-2 sm:flex-row">
      <label className="sr-only" htmlFor="permanent-agent-message">Message the Permanent Agent</label>
      <textarea ref={input} id="permanent-agent-message" value={message} disabled={busy} onChange={event => { selected.current = ""; change(event.target.value); }} onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)} aria-describedby="permanent-agent-writing-help" maxLength={800} rows={3} placeholder="Ask the Permanent Agent… Start with a few words, like ‘booking confirmation’." className="min-w-0 min-h-14 flex-1 resize-y rounded-2xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-400 focus:border-sky-400" />
      <button disabled={busy || !draft} className="min-h-11 rounded-2xl bg-sky-500 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50">{busy ? "Thinking…" : "Send"}</button>
    </div>
    <p id="permanent-agent-writing-help" className="mt-2 text-xs font-semibold text-slate-300">Suggestions adapt as you type. Choose one to edit, then press Send when you’re ready.</p>
    <div aria-label="Suggested ways to ask" className="mt-3 rounded-2xl border border-slate-700 bg-slate-900/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black text-sky-200">{draft ? "Suggested ways to ask" : "Not sure where to start?"}</p>
        <p role="status" className="text-xs text-slate-400">{working && !busy && draft.length >= 4 ? "Updating suggestions…" : ""}</p>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {suggestions.map(suggestion => <button key={suggestion} type="button" disabled={busy} onClick={() => { selected.current = suggestion; change(suggestion); input.current?.focus(); }} className="min-h-11 min-w-0 whitespace-normal break-words rounded-xl border border-slate-600 px-3 py-2 text-left text-sm font-semibold text-white hover:border-sky-400 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 disabled:opacity-50">{suggestion}</button>)}
      </div>
      {!suggestions.length ? <p className="mt-2 text-xs text-slate-300">Leave out passwords, tokens and customer contact details. Describe the task in general terms.</p> : null}
    </div>
  </form>;
}
