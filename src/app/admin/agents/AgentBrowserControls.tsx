"use client";

import { useRef, useState, type FormEvent } from "react";

const initialPage = "/admin/rentals";
const supportedPage = /^(?:\/admin\/(?:rentals|front-desk\/invitations|facility(?:\/[\da-f-]{36}\/invitations)?)|\/booking|\/rentals(?:\/[a-z0-9-]+){0,2})\/?$/i;
const controls = 'button, a[href], input:not([type=hidden]):not([type=password]), select, textarea, summary, [role=button]';

function controlLabel(element: HTMLElement) {
  const label = element.getAttribute("aria-label") || ("labels" in element ? Array.from(element.labels as NodeListOf<HTMLLabelElement> ?? []).map(node => node.textContent).join(" ") : "");
  return (label || element.textContent || element.getAttribute("placeholder") || element.tagName).trim().replace(/\s+/g, " ").slice(0, 100);
}

function visibleControls(doc: Document) {
  return Array.from(doc.querySelectorAll<HTMLElement>(controls)).filter(element =>
    element.getClientRects().length && !element.matches(":disabled,[aria-disabled=true]") &&
    element.ownerDocument.defaultView?.getComputedStyle(element).visibility === "visible"
  ).slice(0, 120);
}

export function AgentBrowserControls() {
  const frame = useRef<HTMLIFrameElement>(null);
  const inspected = useRef<{ document: Document; elements: HTMLElement[] } | null>(null);
  const pending = useRef<AbortController | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [page, setPage] = useState("");
  const [command, setCommand] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [status, setStatus] = useState("");

  function reset() {
    inspected.current = null;
    setLabels([]);
  }

  function run(input: string) {
    try {
      const navigation = /^open (\/[^\s]*)$/i.exec(input);
      if (navigation) {
        const target = new URL(navigation[1], window.location.origin);
        if (target.origin !== window.location.origin || !supportedPage.test(target.pathname)) throw new Error("Choose a rental, checkout, facility, or invitation page.");
        reset();
        const nextPage = target.pathname + target.search + target.hash;
        if (nextPage === page && frame.current) frame.current.src = target.href;
        else setPage(nextPage);
        setStatus("Opening page…");
        return;
      }
      const doc = frame.current?.contentDocument;
      const view = doc?.defaultView;
      if (!doc || !view || !supportedPage.test(view.location.pathname)) throw new Error("Open a supported Jumping Jax page first.");
      if (/^inspect$/i.test(input)) {
        const elements = visibleControls(doc);
        inspected.current = { document: doc, elements };
        setLabels(elements.map(controlLabel));
        setStatus(elements.length ? "Choose a numbered control." : "No visible controls found.");
        return;
      }
      const action = /^(click|focus|type|select)\s+(\d+)(?:\s+([\s\S]+))?$/i.exec(input);
      if (!action) throw new Error("Use open, inspect, click, focus, type, or select.");
      const element = inspected.current?.document === doc ? inspected.current.elements[Number(action[2]) - 1] : undefined;
      if (!element || !visibleControls(doc).includes(element)) throw new Error("Inspect the current page again to refresh its controls.");
      const operation = action[1].toLowerCase();
      const value = action[3] ?? "";
      if (operation === "click") {
        element.scrollIntoView({ block: "nearest" });
        element.click();
      } else if (operation === "focus") {
        element.focus();
      } else {
        const tag = element.tagName;
        const type = element.getAttribute("type")?.toLowerCase() ?? "text";
        const select = operation === "select" && tag === "SELECT";
        const text = operation === "type" && (tag === "TEXTAREA" || (tag === "INPUT" && /^(text|search|email|tel|url|number|date|time)$/.test(type)));
        if ((!select && !text) || element.matches("[readonly]")) throw new Error("Choose an editable field for this command.");
        const prototype = Object.getPrototypeOf(element);
        const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
        if (!setter) throw new Error("This field cannot be edited through browser controls.");
        if (select && !Array.from((element as HTMLSelectElement).options).some(option => option.value === value && !option.disabled)) throw new Error("Use the exact value of an available option.");
        element.focus();
        setter.call(element, value);
        const createEvent = doc.createEvent("Event");
        createEvent.initEvent(select ? "change" : "input", true, false);
        element.dispatchEvent(createEvent);
      }
      setStatus(operation === "click" ? "Clicked. Inspect the page for the result." : operation === "focus" ? "Control focused." : "Field updated.");
    } catch (error) {
      setStatus(error instanceof Error && error.name !== "SecurityError" ? error.message : "The page cannot be controlled.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = command.trim();
    if (!input || pending.current) return;
    setCommand("");
    if (/^(?:inspect$|open \/|(?:click|focus|type|select) \d+(?:\s|$))/i.test(input)) {
      run(input);
      return;
    }
    const doc = frame.current?.contentDocument;
    const elements = doc && supportedPage.test(doc.location.pathname) ? visibleControls(doc) : [];
    const snapshot = { document: doc, elements };
    const controlNames = elements.map(controlLabel);
    const controller = new AbortController();
    pending.current = controller;
    setRequesting(true);
    setStatus("Choosing a browser action…");
    try {
      const response = await fetch("/api/admin/agents/browser-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: input, controls: elements.map((element, index) => ({ label: controlNames[index], tag: element.tagName })) }),
        signal: controller.signal,
      });
      const { decision, error } = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(error || "The agent could not choose a browser action.");
      if (decision.action === "ask") { setStatus(decision.value); return; }
      if (decision.action === "open") { run("open " + decision.value); return; }
      if (!snapshot.document || frame.current?.contentDocument !== snapshot.document) throw new Error("The page changed. Give the instruction again.");
      const target = elements[decision.number - 1];
      const current = visibleControls(snapshot.document);
      if (!target || current[decision.number - 1] !== target || controlLabel(target) !== controlNames[decision.number - 1]) throw new Error("The controls changed. Give the instruction again.");
      inspected.current = { document: snapshot.document, elements };
      run([decision.action, decision.number, decision.value].join(" ").trim());
    } catch (error) {
      if (!controller.signal.aborted) setStatus(error instanceof Error ? error.message : "The browser request failed.");
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setRequesting(false);
      }
    }
  }

  function close() {
    pending.current?.abort();
    pending.current = null;
    setRequesting(false);
    reset();
    setPage("");
    setStatus("");
  }

  if (!page) return <button type="button" className="mt-4 rounded-lg border border-slate-500 px-3 py-2 text-sm font-bold" onClick={() => setPage(initialPage)}>Open browser controls</button>;
  return <section className="mt-4 space-y-3 rounded-xl border border-slate-600 p-3" aria-label="Permanent Agent browser controls">
    <div className="flex items-center justify-between gap-3">
      <h3 className="font-bold">Browser controls</h3>
      <button type="button" onClick={close}>Close</button>
    </div>
    <form onSubmit={submit} className="flex gap-2">
      <input aria-label="Browser command" value={command} maxLength={1000} onChange={event => setCommand(event.target.value)} placeholder="Open the invitation editor or click Search" className="min-w-0 flex-1 rounded-lg bg-white p-2 text-slate-950" />
      <button type="submit" disabled={requesting} className="rounded-lg bg-sky-700 px-3 py-2 font-bold">Run</button>
    </form>
    <p className="text-sm text-slate-300">Tell the agent what to do on this page. It runs one action per instruction. Use <code>inspect</code> to see numbered controls.</p>
    <p role="status" className="text-sm">{status}</p>
    {labels.length ? <ol className="max-h-44 list-decimal overflow-auto pl-8 text-sm">{labels.map((label, index) => <li key={index}>{label}</li>)}</ol> : null}
    <iframe ref={frame} src={page} title="Jumping Jax browser controls" onLoad={reset} className="h-[32rem] w-full rounded-lg bg-white" />
  </section>;
}
