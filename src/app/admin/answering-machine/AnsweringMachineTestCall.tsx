"use client";

import { useState } from "react";
import {
  runAnsweringMachineTestCall,
  type AnsweringMachineTestCallResult,
  type AnsweringMachineTestScenario,
} from "@/lib/answering-machine/test-call";

const scenarios: Array<{ id: AnsweringMachineTestScenario; label: string }> = [
  { id: "facility", label: "Facility party" },
  { id: "rental", label: "Rental" },
  { id: "all_three", label: "All three" },
];

function formatMinutes(value: number) {
  const hour = Math.floor(value / 60);
  const minutes = value % 60;
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })
    .format(new Date(Date.UTC(2027, 0, 1, hour, minutes)));
}

export function AnsweringMachineTestCall() {
  const [scenario, setScenario] = useState<AnsweringMachineTestScenario>("facility");
  const [result, setResult] = useState<AnsweringMachineTestCallResult | null>(null);

  return (
    <section className="mt-7 rounded-3xl border border-sky-200 bg-sky-50 p-5">
      <p className="text-xs font-black uppercase tracking-wide text-sky-800">Safe test call</p>
      <h2 className="mt-1 text-2xl font-black text-slate-950">Preview the agent conversation</h2>
      <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-700">
        This runs the real deterministic booking conversation in simulation mode. It does not place a phone call, contact a customer, or write a booking or calendar.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {scenarios.map((option) => (
          <button key={option.id} type="button" onClick={() => { setScenario(option.id); setResult(null); }}
            className={`rounded-full px-4 py-2 text-sm font-black ${scenario === option.id ? "bg-sky-800 text-white" : "border border-sky-300 bg-white text-sky-950"}`}>
            {option.label}
          </button>
        ))}
        <button type="button" onClick={() => setResult(runAnsweringMachineTestCall(scenario))}
          className="rounded-full bg-slate-950 px-5 py-2 text-sm font-black text-white">
          Run test conversation
        </button>
      </div>

      {result ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-4">
            <h3 className="font-black text-slate-950">Transcript: {result.title}</h3>
            <div className="mt-3 space-y-2 text-sm font-semibold text-slate-700">
              {result.transcript.map((line, index) => <p key={`${index}:${line}`}>{line}</p>)}
            </div>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-white p-4">
            <h3 className="font-black text-slate-950">Booking preview</h3>
            <p className="mt-2 text-sm font-bold text-emerald-800">
              {result.status === "ready_for_approval" ? "Ready for owner review" : "Safely blocked"}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-700">Estimated total: ${(result.quoteTotalCents / 100).toFixed(2)}</p>
            <ul className="mt-3 space-y-2 text-sm font-semibold text-slate-700">
              {result.projections.map((projection) => (
                <li key={`${projection.service}:${projection.date}`} className="rounded-xl bg-slate-50 p-3">
                  {projection.service.replaceAll("_", " ")} · {projection.date} · {formatMinutes(projection.startMinutes)}–{formatMinutes(projection.endMinutes)}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs font-black uppercase text-slate-500">
              Test availability · 0 production writes · 0 customer messages · 0 AI calls
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
