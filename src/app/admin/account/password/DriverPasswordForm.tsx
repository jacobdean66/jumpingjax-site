"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function DriverPasswordForm({ driverNames }: { driverNames: string[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState(driverNames[0] ?? "");
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const inputClass = "mt-1 block min-h-12 w-full rounded-xl border border-slate-200 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-500";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isWorking) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setIsWorking(true);
    setMessage(null);
    setFailed(false);
    try {
      const response = await fetch("/api/admin/account/driver-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          driverName: selected || form.get("driverName"),
          newPassword: form.get("newPassword"),
          confirmPassword: form.get("confirmPassword"),
        }),
      });
      const result = await response.json();
      setFailed(!response.ok || !result.ok);
      setMessage(result.message ?? "Driver password could not be saved.");
      if (response.ok && result.ok) {
        for (const name of ["newPassword", "confirmPassword"]) {
          const field = formElement.elements.namedItem(name);
          if (field instanceof HTMLInputElement) field.value = "";
        }
        router.refresh();
      }
    } catch {
      setFailed(true);
      setMessage("Could not reach the server. The driver password was not saved.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-2xl font-black">Driver Passwords</h2>
      <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
        Choose a driver to change their password, or add a driver login. Drivers sign in with their driver name.
      </p>
      <fieldset disabled={isWorking} className="mt-5 grid gap-4 disabled:opacity-60">
        <label className="text-sm font-bold text-slate-700">
          Driver
          <select value={selected} onChange={(event) => { setSelected(event.target.value); setMessage(null); }} className={inputClass}>
            {driverNames.map((name) => <option key={name} value={name}>{name}</option>)}
            <option value="">Add another driver</option>
          </select>
        </label>
        {!selected ? (
          <label className="text-sm font-bold text-slate-700">
            Driver name / username
            <input name="driverName" required maxLength={100} autoComplete="off" className={inputClass} />
          </label>
        ) : null}
        <label className="text-sm font-bold text-slate-700">
          New driver password
          <input name="newPassword" type="password" autoComplete="new-password" required minLength={6} maxLength={128} className={inputClass} />
        </label>
        <label className="text-sm font-bold text-slate-700">
          Confirm driver password
          <input name="confirmPassword" type="password" autoComplete="new-password" required minLength={6} maxLength={128} className={inputClass} />
        </label>
        <button type="submit" className="min-h-12 rounded-xl bg-sky-600 px-5 py-3 font-black text-white hover:bg-sky-700 disabled:cursor-wait">
          {isWorking ? "Saving password…" : "Save Driver Password"}
        </button>
      </fieldset>
      {message ? (
        <p role={failed ? "alert" : "status"} className={`mt-5 rounded-xl border p-3 text-sm font-bold ${failed ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>{message}</p>
      ) : null}
    </form>
  );
}
