"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { skills, type NetworkAgentKey, type NetworkSkill, type NetworkTask, type NetworkMessage, type NetworkContext } from "@/lib/agent-manager/network/contracts";
import type { NetworkOverview } from "@/lib/agent-manager/network/service";
type Conversation = { context: NetworkContext; tasks: NetworkTask[]; messages: NetworkMessage[] };
const active = (task: NetworkTask) => ["queued", "working", "waiting"].includes(task.status);
async function api(path: string, body?: unknown) {
  const response = await fetch(path, { cache: "no-store", ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("Agent connections are temporarily unavailable. Reload this page and try again.");
  }
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error ?? "Agent network unavailable.");
  return data;
}
export function AgentNetworkPanel({ initial, initialContextId = "" }: { initial: NetworkOverview | null; initialContextId?: string }) {
  const [overview, setOverview] = useState(initial);
  const [recipient, setRecipient] = useState<NetworkAgentKey>("booking");
  const [skill, setSkill] = useState<NetworkSkill>("workflow_review");
  const [selectedId, setSelectedId] = useState(initialContextId);
  const [savedConversation, setConversation] = useState<Conversation | null>(null);
  const conversation = savedConversation?.context.id === selectedId ? savedConversation : null;
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState("rental");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [items, setItems] = useState("");
  const [location, setLocation] = useState("");
  const [distance, setDistance] = useState("");
  const [packageRef, setPackageRef] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ signature: string; requestId: string } | null>(null);
  const selected = overview?.directory.find((agent) => agent.key === recipient);
  const refresh = useCallback(async () => {
    const data = await api("/api/admin/agents/network");
    setOverview(data);
  }, []);
  useEffect(() => {
    if (!selectedId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const data = await api("/api/admin/agents/network?context=" + encodeURIComponent(selectedId));
        if (stopped) return;
        setConversation(data); setError("");
        if (data.tasks.some(active)) timer = setTimeout(poll, 4000);
        else await refresh();
      } catch (e) {
        if (stopped) return;
        setError(e instanceof Error ? e.message : "Conversation unavailable.");
        timer = setTimeout(poll, 10_000);
      }
    };
    void poll();
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }, [selectedId, refresh]);
  useEffect(() => {
    const update = () => { void refresh().catch(() => setError("Agent directory unavailable.")); };
    window.addEventListener("agent-manager:refresh", update);
    return () => window.removeEventListener("agent-manager:refresh", update);
  }, [refresh]);
  function selectConversation(id: string) {
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("conversation", id); else url.searchParams.delete("conversation");
    window.history.replaceState(null, "", url);
  }
  async function submit() {
    setBusy(true); setError("");
    try {
      let input: Record<string, unknown> = {};
      if (skill === "social_handoff") input = { message };
      if (skill === "booking_review" || skill === "availability_review") {
        const [hours, minutes] = time.split(":").map(Number);
        input = { services: [{ kind, ...(date ? { date } : {}), ...(time ? { startMinutes: hours * 60 + minutes } : {}), ...(duration ? { durationMinutes: Number(duration) } : {}), ...(kind === "rental" && items.trim() ? { itemRefs: items.split(",").map((s) => s.trim()).filter(Boolean) } : {}), ...(kind !== "facility_party" && location.trim() ? { locationRef: location.trim() } : {}), ...(kind !== "facility_party" && distance !== "" ? { distanceMiles: Number(distance) } : {}), ...(kind === "facility_party" && packageRef.trim() ? { packageRef: packageRef.trim() } : {}) }] };
      }
      const request = { recipient, skill, input, ...(selectedId ? { contextId: selectedId } : {}), title: selected?.name ?? "Agent conversation" };
      const signature = JSON.stringify(request);
      if (!pending.current || pending.current.signature !== signature) pending.current = { signature, requestId: crypto.randomUUID() };
      const data = await api("/api/admin/agents/network", { ...request, requestId: pending.current.requestId });
      pending.current = null;
      if (data.task.context_id === selectedId) {
        setConversation(await api("/api/admin/agents/network?context=" + encodeURIComponent(selectedId)));
        // Restart polling when another request is added to a finished conversation.
        setSelectedId(""); setTimeout(() => selectConversation(data.task.context_id), 0);
      } else selectConversation(data.task.context_id);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Request unavailable."); }
    finally { setBusy(false); }
  }
  async function cancel() {
    setBusy(true);
    try { await api("/api/admin/agents/network/cancel", { contextId: selectedId }); setConversation(await api("/api/admin/agents/network?context=" + selectedId)); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Cancellation unavailable."); }
    finally { setBusy(false); }
  }
  const field = "w-full rounded-xl border border-slate-300 bg-white p-2 text-sm text-slate-900";
  return <section id="agent-conversations" className="mt-7 rounded-3xl border border-indigo-200 bg-indigo-50 p-5" aria-label="Agent conversations">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black">Agent conversations</h2><p className="mt-1 text-sm text-slate-700">Ask a specialist, follow its handoffs, and keep the reply here. Queued requests run on the existing worker schedule.</p></div>
      <button className="rounded-xl bg-white px-3 py-2 text-sm font-bold" onClick={() => refresh().catch(() => setError("Network unavailable. Apply its migration before activation."))}>Refresh agents</button>
    </div>
    {!overview ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm">Agent network storage is unavailable. Its database migration must be applied before activation.</p> : <>
      <p className="mt-3 text-sm font-bold">{overview.emergencyStop ? "Emergency stop is active." : overview.activeTasks + " active requests"}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {overview.directory.map((agent) => <button key={agent.key} className={`rounded-xl border p-3 text-left ${agent.key === recipient ? "border-indigo-500 bg-white" : "border-slate-200 bg-white/70"}`} onClick={() => { setRecipient(agent.key); setSkill(agent.skills.find((s) => s !== "directory") ?? "directory"); }}>
          <span className="block text-sm font-black">{agent.name}</span><span className="block text-xs font-bold text-indigo-800">{agent.status}</span><span className="mt-1 block text-xs text-slate-600">{agent.description}</span>
        </button>)}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <form className="space-y-3 rounded-2xl bg-white p-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <h3 className="font-black">Ask {selected?.name}</h3>
          <label className="block text-sm font-bold">Capability<select className={field} value={skill} onChange={(e) => setSkill(e.target.value as NetworkSkill)}>{selected?.skills.map((s) => <option key={s} value={s}>{skills[s].name}</option>)}</select></label>
          {skill === "social_handoff" && <label className="block text-sm font-bold">Post request<textarea className={field} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={800} required placeholder="Describe the post to prepare for review" /></label>}
          {(skill === "booking_review" || skill === "availability_review") && <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-bold">Service<select className={field} value={kind} onChange={(e) => setKind(e.target.value)}><option value="rental">Rental</option><option value="facility_party">Facility party</option><option value="foam_party">Foam party</option></select></label>
            <label className="text-sm font-bold">Date<input className={field} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <label className="text-sm font-bold">Start time<input className={field} type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
            <label className="text-sm font-bold">Duration (minutes)<input className={field} type="number" min={1} max={1440} value={duration} onChange={(e) => setDuration(e.target.value)} /></label>
            {kind === "rental" && <label className="col-span-2 text-sm font-bold">Rental item references, separated by commas<input className={field} value={items} onChange={(e) => setItems(e.target.value)} placeholder="Inventory item references" /></label>}
            {kind !== "facility_party" && <><label className="text-sm font-bold">Location reference<input className={field} value={location} onChange={(e) => setLocation(e.target.value)} /></label><label className="text-sm font-bold">Distance (miles)<input type="number" min={0} max={500} className={field} value={distance} onChange={(e) => setDistance(e.target.value)} /></label></>}
            {kind === "facility_party" && <label className="col-span-2 text-sm font-bold">Package reference<input className={field} value={packageRef} onChange={(e) => setPackageRef(e.target.value)} /></label>}
          </div>}
          <p className="text-xs text-slate-600">Use operational details only. Booking, publishing, and customer contact keep their existing approval steps.</p>
          <button className="rounded-xl bg-indigo-800 px-4 py-2 font-bold text-white disabled:opacity-50" disabled={busy || !selected?.available}>Queue request</button>
          <label className="block text-sm font-bold">Conversation<select className={field} value={selectedId} onChange={(e) => selectConversation(e.target.value)}><option value="">New conversation</option>{!overview.contexts.some((c) => c.id === selectedId) && selectedId && <option value={selectedId}>Current conversation</option>}{overview.contexts.map((c) => <option key={c.id} value={c.id}>{c.title} · {new Date(c.created_at).toLocaleString()}</option>)}</select></label>
        </form>
        <div className="rounded-2xl bg-white p-4">
          <div className="flex justify-between gap-2"><h3 className="font-black">Saved handoffs and replies</h3>{conversation?.tasks.some(active) && <button disabled={busy} className="text-sm font-bold text-red-800" onClick={() => void cancel()}>Cancel conversation</button>}</div>
          {!conversation ? <p className="mt-3 text-sm text-slate-600">{selectedId ? "Loading conversation…" : "Choose a saved conversation or queue a request."}</p> : <div className="mt-3 space-y-3" aria-live="polite">
            {conversation.messages.map((m) => <div key={m.id} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-indigo-800">{m.sender_key} → {m.recipient_key} · {m.kind}</p><p className="mt-1 whitespace-pre-wrap text-sm">{m.summary}</p></div>)}
            {conversation.tasks.map((task) => <div key={task.id} className="border-t border-slate-200 pt-2 text-sm"><p className="font-bold">{task.recipient_key} · {task.status.replaceAll("_", " ")}</p>{task.result && <><p>{task.result.summary}</p>{task.result.links?.map((l) => <a key={l.href} className="mr-3 font-bold text-indigo-800 underline" href={l.href}>{l.label}</a>)}<details className="mt-1"><summary>Evidence</summary><pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(task.result.data, null, 2)}</pre></details></>}</div>)}
          </div>}
        </div>
      </div>
    </>}
    {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-900">{error}</p>}
  </section>;
}
