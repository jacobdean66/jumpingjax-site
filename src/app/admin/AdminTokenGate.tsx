"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export function AdminTokenGate() {
  const router = useRouter();
  const pathname = usePathname();
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: token }),
      });

      if (!res.ok) {
        setError("That username and password did not work.");
        return;
      }

      setUsername("");
      setToken("");
      router.replace(pathname);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
        Staff Login
      </p>
      <h1 className="mt-3 text-3xl font-black">Staff sign in</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        Enter your staff username and password. This browser will remember the
        session for the admin dashboards.
      </p>
      <form onSubmit={submit} className="mt-5 space-y-3">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          autoComplete="username"
          className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-sky-500"
        />
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-sky-500"
        />
        {error && <p className="text-sm font-semibold text-rose-700">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !username.trim() || !token.trim()}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Checking..." : "Open dashboard"}
        </button>
      </form>
    </div>
  );
}
