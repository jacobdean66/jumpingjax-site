"use client";

/* The server only supplies first-party, signed-candidate artwork paths. */
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";

export function PreviewArtworkChooser({ id, candidates, attempts }: {
  id: string;
  candidates: { id: string; label: string; imagePath: string }[];
  attempts: number;
}) {
  const [detail, setDetail] = useState("");
  const [searchesUsed, setSearchesUsed] = useState(attempts);
  const [chosen, setChosen] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState<{ searchKey: string; refinement: string } | null>(null);

  async function submit(action: "search" | "confirm") {
    if (busy) return;
    const search = action === "search"
      ? retry ?? { searchKey: crypto.randomUUID(), refinement: detail.trim() } : null;
    if (search) setRetry(search);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/facility-invitation-previews/${id}/artwork`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(search ?? { candidateId: chosen }) }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status < 500) setRetry(null);
        setError(typeof result.error === "string" ? result.error : "The preview is temporarily unavailable.");
        return;
      }
      setRetry(null);
      if (result.status === "busy" || result.status === "duplicate") {
        setError("A search has already started. Check for results to see the latest pictures.");
        return;
      }
      if (result.status === "empty" || result.status === "failed") {
        setSearchesUsed(count => Math.min(3, count + 1));
        setError(result.status === "empty"
          ? "No new matching pictures were found. Try a more specific detail or ask your Jumping Jax representative for help."
          : "The search could not finish. Your previous pictures are still available.");
        return;
      }
      window.location.reload();
    } catch {
      setError("The connection dropped. Retry the same request or reload to check for results.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="space-y-4" aria-label="Choose the invitation picture">
    <h1 className="text-3xl font-black">Choose your invitation picture</h1>
    {candidates.length
      ? <fieldset disabled={busy} className="space-y-3">
          <legend className="mb-2 font-bold">Which picture matches your party?</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {candidates.map(candidate => <label key={candidate.id} className="block rounded border p-3">
              <img src={candidate.imagePath} alt={candidate.label} className="h-40 w-full object-contain"
                onLoad={() => setLoaded(items => [...items, candidate.id])} />
              <input type="radio" name="preview-artwork" checked={chosen === candidate.id}
                disabled={!loaded.includes(candidate.id)} onChange={() => setChosen(candidate.id)} />{" "}
              {candidate.label}
            </label>)}
          </div>
          <button type="button" disabled={!chosen || busy} onClick={() => void submit("confirm")}>
            Confirm this picture and see designs
          </button>
        </fieldset>
      : <p>There are no current pictures to choose from.</p>}
    {searchesUsed < 3
      ? <div className="space-y-2">
          <p>{3 - searchesUsed} of 3 picture searches left. Reloading this page does not use a search.</p>
          <label className="block">Add a detail to refine the search (optional)
            <input className="block w-full rounded border p-2" maxLength={160} value={detail}
              disabled={busy || retry !== null} onChange={event => setDetail(event.target.value)} />
          </label>
          <button type="button" disabled={busy} onClick={() => void submit("search")}>
            {retry ? "Retry the same search request" : "Search for more pictures"}
          </button>
        </div>
      : <p>All three picture searches have been used. Choose a picture above if one is available, or ask your Jumping Jax representative for help.</p>}
    {busy ? <p role="status">Working on your request…</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    <button type="button" disabled={busy} onClick={() => window.location.reload()}>Check for results</button>
  </section>;
}
