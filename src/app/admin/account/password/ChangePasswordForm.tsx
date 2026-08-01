"use client";

import { useState, type FormEvent } from "react";

type PasswordResponse = { ok?: boolean; message?: string };

export function ChangePasswordForm() {
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [changed, setChanged] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isWorking || changed) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setIsWorking(true);
    setMessage(null);
    setFailed(false);
    try {
      const response = await fetch("/api/admin/account/password", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          currentPassword: form.get("currentPassword"),
          newPassword: form.get("newPassword"),
          confirmPassword: form.get("confirmPassword"),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as PasswordResponse;
      if (!response.ok || result.ok === false) {
        setFailed(true);
        setMessage(result.message ?? "Password could not be changed.");
        return;
      }
      formElement.reset();
      setChanged(true);
      setMessage(result.message ?? "Password changed. Sign in again.");
    } catch {
      setFailed(true);
      setMessage("Could not reach the server. Your password was not changed.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <p className="text-sm font-semibold leading-relaxed text-slate-600">
        Enter the current owner password, then choose a new password. Other staff
        accounts are not changed.
      </p>
      <div className="mt-5 grid gap-4">
        <label className="text-sm font-bold text-slate-700">
          Current password
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            disabled={changed}
            className="mt-1 block min-h-12 w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500 disabled:bg-slate-100"
          />
        </label>
        <label className="text-sm font-bold text-slate-700">
          New password
          <input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            disabled={changed}
            className="mt-1 block min-h-12 w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500 disabled:bg-slate-100"
          />
        </label>
        <label className="text-sm font-bold text-slate-700">
          Confirm new password
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            disabled={changed}
            className="mt-1 block min-h-12 w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500 disabled:bg-slate-100"
          />
        </label>
      </div>

      {message ? (
        <p
          role={failed ? "alert" : "status"}
          className={`mt-5 rounded-xl border p-3 text-sm font-bold ${
            failed
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {message}
        </p>
      ) : null}

      {changed ? (
        <a
          href="/admin"
          className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-950 px-5 py-3 font-black text-white"
        >
          Sign in again
        </a>
      ) : (
        <button
          type="submit"
          disabled={isWorking}
          className="mt-5 min-h-12 rounded-xl bg-sky-600 px-5 py-3 font-black text-white hover:bg-sky-700 disabled:cursor-wait disabled:bg-sky-300"
        >
          {isWorking ? "Changing password…" : "Change password"}
        </button>
      )}
    </form>
  );
}
