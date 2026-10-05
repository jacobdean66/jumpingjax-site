"use client";

/* Search pictures come from arbitrary public sources; Next image optimization is intentionally not a remote proxy. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import type { ThemeDesign, ThemeSearchCandidate, ThemeSearchResult } from "@/lib/facility-parties/invitations/theme-search";
import { readThemeResponse } from "@/lib/facility-parties/invitations/theme-response";

const button = "rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50";

/** Parent keys this by query, so editing the theme invalidates every in-flight result. */
export function InvitationThemeSearch({ query, design, onConfirmed, onClear }: {
  query: string;
  design: ThemeDesign | null;
  onConfirmed: (design: ThemeDesign) => void;
  onClear: () => void;
}) {
  const [result, setResult] = useState<ThemeSearchResult | null>(null);
  const [selected, setSelected] = useState<ThemeSearchCandidate | null>(null);
  const [refinements, setRefinements] = useState<string[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [detail, setDetail] = useState("");
  const [loaded, setLoaded] = useState<string[]>([]);
  const [broken, setBroken] = useState<string[]>([]);
  const [busy, setBusy] = useState<"search" | "confirm" | null>(null);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const detailInput = useRef<HTMLInputElement | null>(null);
  useEffect(() => () => { sequence.current += 1; pending.current?.abort(); }, []);

  async function request(path: string, body: unknown) {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setSlow(false);
    const review = setTimeout(() => { if (!controller.signal.aborted) setSlow(true); }, 10000);
    let timedOut = false;
    const deadline = setTimeout(() => { timedOut = true; controller.abort(); }, 50000);
    try {
      const response = await fetch(`/api/facility/invitations/themes/${path}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(body), signal: controller.signal,
    });
      return await readThemeResponse(response);
    } catch (cause) {
      if (timedOut) throw new Error("The search took too long and was stopped. Your theme details are kept. Please retry or add a specific detail.");
      throw cause;
    } finally { clearTimeout(review); clearTimeout(deadline); }
  }

  async function search(interpretation?: string) {
    const ticket = ++sequence.current;
    const extra = interpretation || detail.trim();
    const nextDetails = extra ? [...refinements, extra].slice(-6) : refinements;
    setRefinements(nextDetails); setDetail("");
    setBusy("search"); setError(null); setSelected(null); setResult(null);
    try {
      const data: ThemeSearchResult = await request("search", { query, refinements: nextDetails, rejected });
      if (ticket !== sequence.current) return;
      setResult(data); setRefinements(nextDetails); setDetail(""); setLoaded([]); setBroken([]);
    } catch (cause) {
      if (ticket === sequence.current && !(cause instanceof Error && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "Theme search couldn’t finish. Please try again.");
    } finally { if (ticket === sequence.current) setBusy(null); }
  }

  async function confirm() {
    if (!selected || !loaded.includes(selected.id) || broken.includes(selected.id) || busy) return;
    const ticket = ++sequence.current;
    setBusy("confirm"); setError(null);
    try {
      const next: ThemeDesign = await request("confirm", { selectionToken: selected.selectionToken, confirmed: true });
      if (ticket === sequence.current) onConfirmed(next);
    } catch (cause) {
      if (ticket === sequence.current && !(cause instanceof Error && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "The picture couldn’t be saved. Please try another match.");
    } finally { if (ticket === sequence.current) setBusy(null); }
  }

  function reject() {
    if (selected) setRejected(previous => [...previous, selected.label].slice(-12));
    setSelected(null); setError(null);
    detailInput.current?.focus();
  }

  if (design) return (
    <div className="mt-3 rounded-xl border border-emerald-300/40 bg-emerald-950/30 p-4" data-theme-confirmed="true">
      <p className="text-sm font-bold text-emerald-100">Confirmed theme: {design.theme.label}</p>
      <p className="mt-1 text-sm text-slate-200">Your invitations will use the picture you chose.</p>
      <button type="button" className="mt-3 text-sm font-bold text-cyan-200 underline" onClick={onClear}>Change character or theme</button>
    </div>
  );

  const shown = selected ? [selected] : result?.candidates ?? [];
  return (
    <section className="mt-3 rounded-xl border border-cyan-300/30 bg-[#071326] p-4" aria-label="Find your invitation theme">
      <p className="text-sm text-slate-200">Find a show, character, movie, game, team, or any party theme. Check the picture before we make your invitations.</p>
      {!result && !selected ? <button type="button" className={`${button} mt-3`} disabled={Boolean(busy) || query.trim().length < 2} onClick={() => void search()}>Search themes and characters</button> : null}
      <div aria-live="polite">
        {busy ? <p className="mt-3 text-sm font-bold text-cyan-100">{busy === "search" ? slow ? "This search is taking longer. The supervisor is checking saved artwork; the search will stop if it cannot finish." : "Finding matching themes and pictures…" : "Saving your chosen picture and making your invitation…"}</p> : null}
        {busy ? <button type="button" className="mt-2 text-sm font-bold text-cyan-200 underline" onClick={() => { sequence.current += 1; pending.current?.abort(); setBusy(null); setSlow(false); }}>Cancel {busy === "search" ? "search" : "confirmation"}</button> : null}
        {error ? <p role="alert" className="mt-3 text-sm text-rose-200">{error}</p> : null}
        {result ? <p className="mt-4 font-bold text-white">{selected ? "Is this the right character or theme?" : result.candidates.length ? "Which picture matches the theme you want? Select a picture to check it, or add details below." : result.question}</p> : null}
      </div>
      {result?.interpretations?.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {result.interpretations.map(interpretation => <button type="button" key={interpretation}
          className={button} disabled={Boolean(busy)} onClick={() => void search(interpretation)}>{interpretation}</button>)}
      </div> : null}
      <div className={`mt-3 grid gap-3 ${selected ? "" : "sm:grid-cols-2"}`}>
        {shown.map(candidate => (
          <div key={candidate.id} className="overflow-hidden rounded-xl border border-white/20 bg-white text-slate-950">
            <button type="button" disabled={Boolean(busy) || broken.includes(candidate.id) || !loaded.includes(candidate.id)} className="w-full text-left disabled:cursor-not-allowed" onClick={() => { setSelected(candidate); setError(null); }} aria-label={`Check ${candidate.label}`}>
              <img src={candidate.imagePath ?? candidate.imageUrl} alt={candidate.label} referrerPolicy="no-referrer" className="h-52 w-full bg-slate-50 object-contain" onLoad={() => setLoaded(previous => previous.includes(candidate.id) ? previous : [...previous, candidate.id])} onError={() => setBroken(previous => previous.includes(candidate.id) ? previous : [...previous, candidate.id])} />
              <span className="block px-3 pt-3 font-bold">{candidate.label}</span>
              <span className="block px-3 pb-3 text-sm">{candidate.description}</span>
            </button>
            {broken.includes(candidate.id) ? <p className="px-3 pb-3 text-sm text-red-700">This picture could not load. Choose another match or refine the search.</p> : null}
            <a href={candidate.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-block px-3 pb-3 text-xs text-sky-800 underline">Picture source</a>
          </div>
        ))}
      </div>
      {selected ? (
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" className={button} disabled={Boolean(busy) || broken.includes(selected.id) || !loaded.includes(selected.id)} onClick={() => void confirm()}>Yes, this is correct — make invitations</button>
          <button type="button" disabled={Boolean(busy)} className="rounded-xl border border-white/30 px-4 py-3 text-sm font-bold text-white" onClick={reject}>No, help me find it</button>
        </div>
      ) : null}
      {result || refinements.length || error ? (
        <div className="mt-4">
          <label className="block text-sm font-bold text-white" htmlFor="theme-search-detail">What should I look for?</label>
          <input ref={detailInput} id="theme-search-detail" value={detail} maxLength={300} disabled={Boolean(busy)} onChange={event => setDetail(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); if (!busy && detail.trim()) void search(); } }} placeholder="e.g. the purple-haired character from the movie" className="mt-2 w-full rounded-xl bg-white px-3 py-3 text-slate-950" />
          <button type="button" className={`${button} mt-3`} disabled={Boolean(busy) || !detail.trim()} onClick={() => void search()}>Search with these details</button>
          {refinements.length ? <p className="mt-2 text-xs text-slate-300">Details so far: {refinements.join(" · ")}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
