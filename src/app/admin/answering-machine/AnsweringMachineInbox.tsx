"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import type { AnsweringMachineCall } from "@/lib/answering-machine/types";

type Readiness = {
  provider: "WhatsApp Business Calling API";
  mode: "native_voicemail" | "interactive_bridge";
  enabled: boolean;
  configured: boolean;
  live: boolean;
  status: "CALL READY" | "VOICEMAIL READY" | "SETUP REQUIRED";
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

const callReviewSchema = z.object({
  serviceKind: z.enum(["", "rental", "facility_party"]),
  eventDate: z.string().max(10),
  facilityStartTime: z.string().max(5),
  rentalItems: z.array(z.string().max(120)).max(20),
  transcript: z.string().max(50000),
  transcriptComplete: z.boolean(),
  agentSummary: z.string().max(2000),
  ownerNotes: z.string().max(2000),
  customerName: z.string().max(120),
  customerEmail: z.string().max(254),
  customerPhone: z.string().max(40),
  eventStartTime: z.string().max(5),
  duration: z.string().max(80),
  requestedDeliveryWindow: z.string().max(100),
  eventAddress: z.string().max(500),
  distanceMiles: z.string().max(10),
  setupSurface: z.string().max(120),
  setupAccess: z.string().max(500),
  setupNotes: z.string().max(2000),
  paymentMethod: z.enum(["Cash", "Card"]),
  facilityPartyKind: z.enum(["public", "private"]),
  facilityRoom: z.enum(["room-10", "room-20"]),
  facilityDurationMinutes: z.enum(["90", "120", "180"]),
  childName: z.string().max(120),
  childGender: z.string().max(80),
  childAge: z.string().max(40),
  partyTheme: z.string().max(200),
  drinkChoice: z.string().max(120),
}).strict();

type CallReviewValues = z.infer<typeof callReviewSchema>;

type RentalOption = { slug: string; title: string };

function CallReviewCard({ call, rentalOptions, onUpdate }: {
  call: AnsweringMachineCall;
  rentalOptions: RentalOption[];
  onUpdate: (call: AnsweringMachineCall) => void;
}) {
  const [message, setMessage] = useState("");
  const { register, control, handleSubmit, formState: { isSubmitting } } = useForm<CallReviewValues>({
    resolver: zodResolver(callReviewSchema),
    defaultValues: {
      serviceKind: call.serviceKind ?? "",
      eventDate: call.eventDate ?? "",
      facilityStartTime: call.facilityStartTime ?? "",
      rentalItems: call.rentalItems,
      transcript: call.transcript,
      transcriptComplete: call.transcriptComplete,
      agentSummary: call.agentSummary,
      ownerNotes: call.ownerNotes,
      customerName: call.bookingDetails.customerName,
      customerEmail: call.bookingDetails.customerEmail,
      customerPhone: call.bookingDetails.customerPhone,
      eventStartTime: call.bookingDetails.eventStartTime,
      duration: call.bookingDetails.duration,
      requestedDeliveryWindow: call.bookingDetails.requestedDeliveryWindow,
      eventAddress: call.bookingDetails.eventAddress,
      distanceMiles: call.bookingDetails.distanceMiles?.toString() ?? "",
      setupSurface: call.bookingDetails.setupSurface,
      setupAccess: call.bookingDetails.setupAccess,
      setupNotes: call.bookingDetails.setupNotes,
      paymentMethod: call.bookingDetails.paymentMethod === "Cash" ? "Cash" : "Card",
      facilityPartyKind: call.bookingDetails.facilityPartyKind,
      facilityRoom: call.bookingDetails.facilityRoom,
      facilityDurationMinutes: call.bookingDetails.facilityDurationMinutes.toString() as "90" | "120" | "180",
      childName: call.bookingDetails.childName,
      childGender: call.bookingDetails.childGender,
      childAge: call.bookingDetails.childAge,
      partyTheme: call.bookingDetails.partyTheme,
      drinkChoice: call.bookingDetails.drinkChoice,
    },
  });
  const serviceKind = useWatch({ control, name: "serviceKind" });
  const eventDate = useWatch({ control, name: "eventDate" });
  const facilityStartTime = useWatch({ control, name: "facilityStartTime" });
  const rentalItems = useWatch({ control, name: "rentalItems" });
  const transcriptComplete = useWatch({ control, name: "transcriptComplete" });
  const facilityPartyKind = useWatch({ control, name: "facilityPartyKind" });
  const terminal = Boolean(call.bookingId) || call.status === "rejected";

  const approvalReady = transcriptComplete && Boolean(serviceKind) && Boolean(eventDate)
    && (serviceKind === "facility_party" ? Boolean(facilityStartTime) : rentalItems.length > 0);

  async function submit(action: "save" | "book" | "reject", values: CallReviewValues) {
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
            serviceKind: values.serviceKind || null,
            eventDate: values.eventDate || null,
            facilityStartTime: values.serviceKind === "facility_party" ? values.facilityStartTime || null : null,
            rentalItems: values.serviceKind === "rental" ? values.rentalItems : [],
            transcript: values.transcript,
            transcriptComplete: values.transcriptComplete,
            agentSummary: values.agentSummary,
            ownerNotes: values.ownerNotes,
            bookingDetails: {
              customerName: values.customerName.trim(), customerEmail: values.customerEmail.trim(),
              customerPhone: values.customerPhone.trim(), eventStartTime: values.eventStartTime,
              duration: values.duration.trim(), requestedDeliveryWindow: values.requestedDeliveryWindow.trim(),
              eventAddress: values.eventAddress.trim(),
              distanceMiles: values.distanceMiles.trim() ? Number(values.distanceMiles) : null,
              setupSurface: values.setupSurface.trim(), setupAccess: values.setupAccess.trim(),
              setupNotes: values.setupNotes.trim(), paymentMethod: values.paymentMethod,
              facilityPartyKind: values.facilityPartyKind, facilityRoom: values.facilityRoom,
              facilityDurationMinutes: Number(values.facilityDurationMinutes) as 90 | 120 | 180,
              childName: values.childName.trim(), childGender: values.childGender.trim(),
              childAge: values.childAge.trim(), partyTheme: values.partyTheme.trim(),
              drinkChoice: values.drinkChoice.trim(),
            },
          },
        }),
      });
      const body = await response.json() as { ok: boolean; call?: AnsweringMachineCall; error?: string };
      if (!response.ok || !body.call) throw new Error(body.error ?? "Review failed safely.");
      onUpdate(body.call);
      setMessage(action === "book" ? `Booking ${body.call.bookingId} was created and is waiting for normal confirmation.` : action === "reject" ? "Rejected and retained in history." : "Changes saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Review failed safely.");
    }
  }

  function runAction(action: "save" | "book" | "reject") {
    void handleSubmit(
      (values) => submit(action, values),
      () => setMessage("Review fields are invalid or exceed their safe limits."),
    )();
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
          {call.voicemailAvailable ? (
            <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3">
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-600">Recorded voicemail</p>
              <audio controls preload="none" src={`/api/admin/answering-machine/${call.id}/audio`} className="w-full" />
            </div>
          ) : null}
          <label className="block text-sm font-black text-slate-800">
            Call transcript
            <textarea {...register("transcript")} rows={12} maxLength={50000}
              className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium leading-relaxed outline-none focus:border-violet-500" />
          </label>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            {transcriptComplete ? "Transcription complete—review wording before approval." : "Type or correct the voicemail transcript, then mark it complete."}
          </p>
          <label className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-800">
            <input type="checkbox" {...register("transcriptComplete")} disabled={terminal} />
            I finished typing and checking this transcript
          </label>
        </section>

        <section className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <label className="block text-sm font-black text-slate-800">
            Booking type
            <select {...register("serviceKind")}
              className="mt-2 block w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-base font-bold">
              <option value="">Choose after reviewing</option>
              <option value="rental">Rental / foam party</option>
              <option value="facility_party">Facility party</option>
            </select>
          </label>
          <label className="block text-sm font-black text-slate-800">
            Event date
            <input type="date" {...register("eventDate")}
              className="mt-2 block w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-base font-bold" />
          </label>
          {serviceKind === "facility_party" ? (
            <label className="block text-sm font-black text-slate-800">
              Facility start time
              <input type="time" {...register("facilityStartTime")}
                className="mt-2 block w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-base font-bold" />
            </label>
          ) : null}
          {serviceKind === "rental" ? (
            <label className="block text-sm font-black text-slate-800">
              Rental selection
              <select multiple size={Math.min(8, Math.max(4, rentalOptions.length))} {...register("rentalItems")}
                className="mt-2 block w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-bold">
                {rentalOptions.map((rental) => <option key={rental.slug} value={rental.slug}>{rental.title}</option>)}
              </select>
              <span className="mt-1 block text-xs font-semibold text-slate-500">Hold Ctrl while clicking to select more than one rental.</span>
            </label>
          ) : null}
          <label className="block text-sm font-black text-slate-800">
            Agent summary
            <textarea {...register("agentSummary")} rows={3} maxLength={2000}
              className="mt-2 block w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-medium" />
          </label>
          <label className="block text-sm font-black text-slate-800">
            Owner notes
            <textarea {...register("ownerNotes")} rows={3} maxLength={2000}
              className="mt-2 block w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-medium" />
          </label>
        </section>
      </div>

      <section className="mt-4 border-t border-slate-200 pt-4">
        <h3 className="text-base font-black text-slate-950">Customer and booking details</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="text-sm font-bold">Customer name<input {...register("customerName")} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="text-sm font-bold">Email<input type="email" {...register("customerEmail")} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="text-sm font-bold">Phone<input type="tel" {...register("customerPhone")} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
        </div>

        {serviceKind === "rental" ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-bold">Event start time<input type="time" {...register("eventStartTime")} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-bold">Rental duration<select {...register("duration")} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"><option>4 Hours</option><option>8 Hours</option><option>Overnight</option><option>2 Days</option></select></label>
            <label className="text-sm font-bold">Requested delivery window<input {...register("requestedDeliveryWindow")} placeholder="8:00 AM - 10:00 AM" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-bold md:col-span-2">Event address<input {...register("eventAddress")} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-bold">Distance in miles<input type="number" min="0" max="500" step="0.1" {...register("distanceMiles")} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-bold">Setup surface<input {...register("setupSurface")} placeholder="Grass, pavement, indoors" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-bold md:col-span-2">Setup access<input {...register("setupAccess")} placeholder="Gate width, stairs, parking instructions" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-bold md:col-span-3">Setup notes<textarea rows={2} {...register("setupNotes")} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          </div>
        ) : null}

        {serviceKind === "facility_party" ? (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="text-sm font-bold">Party type<select {...register("facilityPartyKind")} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"><option value="public">Public Play Party</option><option value="private">Private Party</option></select></label>
            {facilityPartyKind === "public" ? <label className="text-sm font-bold">Party room<select {...register("facilityRoom")} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"><option value="room-10">10 kid room</option><option value="room-20">20 kid room</option></select></label> : null}
            <label className="text-sm font-bold">Duration<select {...register("facilityDurationMinutes")} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"><option value="90">1.5 hours</option>{facilityPartyKind === "private" ? <><option value="120">2 hours</option><option value="180">3 hours</option></> : null}</select></label>
            <label className="text-sm font-bold">Birthday child<input {...register("childName")} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-bold">Child gender<input {...register("childGender")} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-bold">Child age<input {...register("childAge")} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-bold">Party theme<input {...register("partyTheme")} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-bold">Drink choice<select {...register("drinkChoice")} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Choose</option><option>Capri-Sun</option><option>Kool-Aid Jammers</option><option>Gatorade</option><option>Soda</option><option>Huggs</option></select></label>
          </div>
        ) : null}

        <label className="mt-3 block max-w-xs text-sm font-bold">Payment method<select {...register("paymentMethod")} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"><option>Card</option><option>Cash</option></select></label>
      </section>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={isSubmitting || terminal} onClick={() => runAction("save")}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-800 disabled:opacity-50">Save edits</button>
        <button type="button" disabled={isSubmitting || terminal || !approvalReady} onClick={() => runAction("book")}
          className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Create booking request</button>
        <button type="button" disabled={isSubmitting || terminal} onClick={() => runAction("reject")}
          className="rounded-full bg-rose-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50">Reject</button>
      </div>
      {!approvalReady && call.status !== "approved" ? (
        <p className="mt-2 text-xs font-bold text-amber-800">Approval requires a completed transcript plus the date and required service details.</p>
      ) : null}
      {message ? <p role="status" className="mt-3 text-sm font-bold text-slate-700">{message}</p> : null}
      {call.bookingId ? <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-black text-emerald-900">Created {call.bookingKind === "rental" ? "rental" : "facility"} booking: {call.bookingId}</p> : null}
      {call.bookingError ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-900">Last booking attempt: {call.bookingError}</p> : null}
    </article>
  );
}

export function AnsweringMachineInbox({ initialCalls, rentalOptions, readiness, storageError }: {
  initialCalls: AnsweringMachineCall[];
  rentalOptions: RentalOption[];
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
            The review inbox is prepared, but WhatsApp stays disabled until Meta credentials and the selected voice mode are connected.
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
          {calls.length > 0 ? calls.map((call) => <CallReviewCard key={`${call.id}:${call.revision}`} call={call} rentalOptions={rentalOptions} onUpdate={updateCall} />) : (
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
