"use client";

import { FileUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SwipeSimpleCsvImport() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setErrors([]);
    try {
      const response = await fetch("/api/admin/payments/swipesimple-import", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setErrors(Array.isArray(result.errors) ? result.errors : []);
        throw new Error(result.message || "The SwipeSimple report could not be imported.");
      }
      setMessage(result.message);
      event.currentTarget.reset();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The report could not be imported.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <FileUp className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
        <div>
          <h2 className="text-xl font-black">Import SwipeSimple report</h2>
          <p className="mt-2 text-sm text-slate-600">
            Export Transaction History as CSV, then upload it here. Re-importing the same report is safe. A receipt is never credited to a booking from its name or amount alone.
          </p>
        </div>
      </div>
      <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="grid min-w-0 flex-1 gap-1 text-sm font-bold">
          Transaction report CSV
          <input
            type="file"
            name="file"
            required
            accept=".csv,text/csv,text/tab-separated-values"
            disabled={busy}
            className="min-h-11 min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:font-bold"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-md bg-blue-700 px-4 py-2 font-bold text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {busy ? "Importing..." : "Import CSV"}
        </button>
      </form>
      {message ? <p role="status" className="mt-3 text-sm font-bold">{message}</p> : null}
      {errors.length ? (
        <ul className="mt-2 list-disc pl-5 text-sm text-rose-800">
          {errors.map((error) => <li key={error}>{error}</li>)}
        </ul>
      ) : null}
      <p className="mt-3 text-xs text-slate-500">
        After importing, use the exact transaction number in Record mobile payment or on the booking payment form to attach an unmatched receipt.
      </p>
    </section>
  );
}

