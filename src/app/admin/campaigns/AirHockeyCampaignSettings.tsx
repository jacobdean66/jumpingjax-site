"use client";

import { useState } from "react";
import type { AirHockeyCampaignEvent } from "@/lib/admin/air-hockey-campaign";

export function AirHockeyCampaignSettings({ event }: { event: AirHockeyCampaignEvent }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  async function onSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = new FormData(formEvent.currentTarget);
    setState("saving");
    const response = await fetch("/api/admin/campaigns/air-hockey", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    setState(response.ok ? "saved" : "error");
  }
  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-4">
        <label className="text-sm font-bold text-slate-700">Status<select name="status" defaultValue={event.status} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base"><option value="draft">Draft</option><option value="published">Published</option><option value="paused">Paused</option><option value="closed">Closed</option></select></label>
        <label className="text-sm font-bold text-slate-700">Date<input type="date" name="eventDate" defaultValue={event.eventDate ?? ""} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base" /></label>
        <label className="text-sm font-bold text-slate-700">Start<input type="time" name="startTime" defaultValue={event.startTime?.slice(0, 5) ?? ""} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base" /></label>
        <label className="text-sm font-bold text-slate-700">End<input type="time" name="endTime" defaultValue={event.endTime?.slice(0, 5) ?? ""} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base" /></label>
      </div>
      <div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-bold text-slate-700">Entry price label<input name="signupPrice" defaultValue={event.signupPrice ?? ""} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base" /></label><label className="text-sm font-bold text-slate-700">Capacity<input type="number" min="0" name="signupCapacity" defaultValue={event.signupCapacity ?? ""} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base" /></label></div>
      <label className="text-sm font-bold text-slate-700">Landing page description<textarea name="shortDescription" rows={2} defaultValue={event.shortDescription ?? ""} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base" /></label><label className="text-sm font-bold text-slate-700">Main offer text<textarea name="offerText" rows={2} defaultValue={event.offerText ?? ""} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base" /></label><label className="text-sm font-bold text-slate-700">Rules / disclaimer text<textarea name="rulesText" rows={2} defaultValue={event.rulesText ?? ""} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base" /></label>
      <div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-bold text-slate-700">Meta campaign ID<input name="metaCampaignId" defaultValue={event.metaCampaignId ?? ""} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base" /></label><label className="text-sm font-bold text-slate-700">Meta campaign name<input name="metaCampaignName" defaultValue={event.metaCampaignName ?? ""} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-base" /></label></div>
      <div className="flex flex-wrap items-center gap-3"><button type="submit" disabled={state === "saving"} className="rounded-full bg-slate-950 px-5 py-2 text-sm font-black text-white disabled:bg-slate-400">{state === "saving" ? "Saving..." : "Save campaign"}</button>{state === "saved" ? <span className="text-sm font-black text-emerald-700">Saved</span> : null}{state === "error" ? <span className="text-sm font-black text-rose-700">Save failed</span> : null}</div>
    </form>
  );
}

