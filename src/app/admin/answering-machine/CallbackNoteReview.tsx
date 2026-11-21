"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CallbackNoteReview({ id }: { id: string }) {
  const router = useRouter();
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  async function review() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/receptionist-callback-notes/${encodeURIComponent(id)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) throw Error();
      router.refresh();
    } catch { setError("Could not mark this note reviewed. Please try again."); }
    finally { setBusy(false); }
  }
  return <div><button type="button" onClick={review} disabled={busy} className="mt-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Mark reviewed"}</button>{error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}</div>;
}
