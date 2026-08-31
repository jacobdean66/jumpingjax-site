"use client";

import { useState } from "react";
import type { AnsweringMachineCall, AnsweringMachineServiceKind } from "@/lib/answering-machine/types";

type Readiness = {
  provider: "WhatsApp Business Calling API";
  enabled: boolean;
  configured: boolean;
  live: boolean;
  status: "CALL READY" | "SETUP REQUIRED";
  missing: readonly string[];
  captureRules: { facilityParty: string[]; rental: string[] };
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusTone(status: AnsweringMachineCall["status"]) {
  if (status === "approved") return "border-emerald-200 bg-emerald-100 text-emerald-900";
  if (status === "needs_review") return "border-amber-200 bg-amber-100 text-amber-950";
  if (status === "rejected" || status === "failed") return "border-rose-200 bg-rose-100 text-rose-900";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function CallReviewCard({ call, onUpdate }: { call: AnsweringMachineCall; onUpdate: (call: AnsweringMachineCall) => void }) {
  const [serviceKind, setServiceKind] = useState<AnsweringMachineServiceKind | "">(call.serviceKind ?? "");
  const [eventDate, setEventDate] = useState(call.eventDate ?? "");
  const [facilityStartTime, setFacilityStartTime] = useState(call.facilityStartTime ?? "");
  const [rentalItems, setRentalItems] = useState(call.rentalItems.join(", "));
  const [transcript, setTranscript] = useState(call.transcript);
  const [agentSummary, setAgentSummary] = useState(call.agentSummary);
  const [ownerNotes, setOwnerNotes] = useState(call.ownerNotes);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const terminal = call.status === "approved" || call.status === "rejected";

  const approvalReady = call.transcriptComplete && Boolean(serviceKind) && Boolean(eventDate)
    && (serviceKind === "facility_party" ? Boolean(facilityStartTime) : rentalItems.split(",").some((item) => item.trim()));

  async function submit(action: "save" | "approve" | "reject") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/answering-machine", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: call.id,
          action,
          expectedRevision: call.revision,
          patch: {
            serviceKind: serviceKind || null,
            eventDate: eventDate || null,
            facilityStartTime: serviceKind === "facility_party" ? facilityStartTime || null : null,
            rentalItems: serviceKind === "rental" ? rentalItems.split(",").map((item) => item.trim()).filter(Boolean) : [],
            transcript,
            agentSummary,
            ownerNotes,
          },
        }),
      });
      const body = await response.json() as { ok: boolean; call?: AnsweringMachineCall; error?: string };
      if (!response.ok || !body.call) throw new Error(body.error ?? "Review failed safely.");
      onUpdate(body.call);
      setMessage(action === "approve" ? "Approved for the next staged booking step." : action === "reject" ? "Rejected and retained in history." : "Changes saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Review failed safely.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.13em] text-violet-700">{call.callReference}</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">{call.callerLabel}</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Received {formatTimestamp(call.createdAt)}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${statusTone(call.status)}`}>
          {call.status.replaceAll("_", " ")}
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-slate-50 p-4">
          <label className="block text-sm font-black text-slate-800">
            Call transcript
            <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} rows={12} maxLength={50000}
              className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium leading-relaxed outline-none focus:border-violet-500" />
          </label>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            {call.transcriptComplete ? "Transcription complete—review wording before approval." : "Call audio is still processing; approval stays locked."}
          </p>
        </section>

        <section className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <label className="block text-sm font-black text-slate-800">
            Booking type
            <select value={serviceKind} onChange={(event) => setServiceKind(event.target.value as AnsweringMachineServiceKind | "")}
              className="mt-2 block w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-base font-bold">
              <option value="">Choose after reviewing</option>
              <option value="rental">Rental / foam party</option>
              <option value="facility_party">Facility party</option>
            </select>
          </label>
          <label className="block text-sm font-black text-slate-800">
            Event date
            <input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)}
              className="mt-2 block w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-base font-bold" />
          </label>
          {serviceKind === "facility_party" ? (
            <label className="block text-sm font-black text-slate-800">
              Facility start time
              <input type="time" value={facilityStartTime} onChange={(event) => setFacilityStartTime(event.target.value)}
                className="mt-2 block w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-base font-bold" />
            </label>
          ) : null}
          {serviceKind === "rental" ? (
            <label className="block text-sm font-black text-slate-800">
              Rental selection
              <input value={rentalItems} onChange={(event) => setRentalItems(event.target.value)} maxLength={2400}
                placeholder="Bounce house, foam party package"
                className="mt-2 block w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-base font-bold" />
              <span className="mt-1 block text-xs font-semibold text-slate-500">Separate multiple rentals with commas. Foam parties belong here.</span>
            </label>
          ) : null}
          <label className="block text-sm font-black text-slate-800">
            Agent summary
            <textarea value={agentSummary} onChange={(event) => setAgentSummary(event.target.value)} rows={3} maxLength={2000}
              className="mt-2 block w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-medium" />
          </label>
          <label className="block text-sm font-black text-slate-800">
            Owner notes
            <textarea value={ownerNotes} onChange={(event) => setOwnerNotes(event.target.value)} rows={3} maxLength={2000}
              className="mt-2 block w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-medium" />
          </label>
        </section>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy || terminal} onClick={() => void submit("save")}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-800 disabled:opacity-50">Save edits</button>
        <button type="button" disabled={busy || terminal || !approvalReady} onClick={() => void submit("approve")}
          className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Approve information</button>
        <button type="button" disabled={busy || terminal} onClick={() => void submit("reject")}
          className="rounded-full bg-rose-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50">Reject</button>
      </div>
      {!approvalReady && call.status !== "approved" ? (
        <p className="mt-2 text-xs font-bold text-amber-800">Approval requires a completed transcript plus the date and required service details.</p>
      ) : null}
      {message ? <p role="status" className="mt-3 text-sm font-bold text-slate-700">{message}</p> : null}
    </article>
  );
}

export function AnsweringMachineInbox({ initialCalls, readiness, storageError }: {
  initialCalls: AnsweringMachineCall[];
  readiness: Readiness;
  storageError: string | null;
}) {
  const [calls, setCalls] = useState(initialCalls);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState(storageError ?? "");

  async function refresh() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/admin/answering-machine", { cache: "no-store" });
      const body = await response.json() as { ok: boolean; calls?: AnsweringMachineCall[]; error?: string };
      if (!response.ok || !body.calls) throw new Error(body.error ?? "Inbox refresh failed safely.");
      setCalls(body.calls);
      setMessage("Inbox refreshed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Inbox refresh failed safely.");
    } finally {
      setRefreshing(false);
    }
  }

  function updateCall(next: AnsweringMachineCall) {
    setCalls((current) => current.map((call) => call.id === next.id ? next : call));
  }

  return (
    <>
      <section className={`mt-7 rounded-3xl border p-5 ${readiness.live ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-600">Phone connection</p>
            <h2 className="mt-1 text-2xl font-black">{readiness.provider}</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-700">
              Facility parties capture the event date and start time. Rentals—including foam parties—capture the rental selection and event date.
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-black text-white ${readiness.live ? "bg-emerald-700" : "bg-amber-700"}`}>{readiness.status}</span>
        </div>
        {!readiness.live ? (
          <p className="mt-4 rounded-2xl bg-white p-3 text-sm font-bold text-amber-950">
            The review inbox is prepared, but live WhatsApp calls stay disabled until Meta credentials and the secure media bridge are connected.
          </p>
        ) : null}
      </section>

      <section className="mt-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-violet-700">Private transcript inbox</p>
            <h2 className="mt-1 text-2xl font-black">Voicemails and booking details</h2>
          </div>
          <button type="button" disabled={refreshing} onClick={() => void refresh()}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-50">
            {refreshing ? "Refreshing…" : "Refresh inbox"}
          </button>
        </div>
        {message ? <p role="status" className="mt-3 rounded-xl bg-white p-3 text-sm font-bold text-slate-700">{message}</p> : null}
        <div className="mt-4 grid gap-5">
          {calls.length > 0 ? calls.map((call) => <CallReviewCard key={`${call.id}:${call.revision}`} call={call} onUpdate={updateCall} />) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <h3 className="text-xl font-black">No WhatsApp calls yet</h3>
              <p className="mt-2 text-sm font-semibold text-slate-600">Completed call transcripts will appear here for editing and approval.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
