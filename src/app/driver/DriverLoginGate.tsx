"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function DriverLoginGate() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/driver/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        setError("That driver name and password did not work.");
        return;
      }

      setUsername("");
      setPassword("");
      const query = searchParams.toString();
      router.replace(query ? `/driver?${query}` : "/driver");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
        Driver App
      </p>
      <h1 className="mt-3 text-3xl font-black">Driver sign in</h1>
      <form onSubmit={submit} className="mt-5 space-y-3">
        <input
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Driver name"
          autoComplete="username"
          className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-sky-500"
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-sky-500"
        />
        {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
        <button
          type="submit"
          disabled={submitting || !username.trim() || !password.trim()}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Checking..." : "Open driver app"}
        </button>
      </form>
    </div>
  );
}
