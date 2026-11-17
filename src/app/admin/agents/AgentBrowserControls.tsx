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
  const [page, setPage] = useState("");
  const [command, setCommand] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [status, setStatus] = useState("");

  function reset() {
    inspected.current = null;
    setLabels([]);
  }

  function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = command.trim();
    setCommand("");
    try {
      const navigation = /^open (\/[^\s]*)$/i.exec(input);
      if (navigation) {
        const target = new URL(navigation[1], window.location.origin);
        if (target.origin !== window.location.origin || !supportedPage.test(target.pathname)) throw new Error("Choose a rental, checkout, facility, or invitation page.");
        reset();
        if (frame.current) frame.current.src = target.href;
        setPage(target.pathname + target.search + target.hash);
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

  if (!page) return <button type="button" className="mt-4 rounded-lg border border-slate-500 px-3 py-2 text-sm font-bold" onClick={() => setPage(initialPage)}>Open browser controls</button>;
  return <section className="mt-4 space-y-3 rounded-xl border border-slate-600 p-3" aria-label="Permanent Agent browser controls">
    <div className="flex items-center justify-between gap-3">
      <h3 className="font-bold">Browser controls</h3>
      <button type="button" onClick={() => { reset(); setPage(""); setStatus(""); }}>Close</button>
    </div>
    <form onSubmit={run} className="flex gap-2">
      <input aria-label="Browser command" value={command} maxLength={1000} onChange={event => setCommand(event.target.value)} placeholder="inspect, click 2, type 3 Space theme" className="min-w-0 flex-1 rounded-lg bg-white p-2 text-slate-950" />
      <button type="submit" className="rounded-lg bg-sky-700 px-3 py-2 font-bold">Run</button>
    </form>
    <p className="text-sm text-slate-300">Use <code>open /booking</code> to navigate, <code>inspect</code> to list controls, then <code>click 2</code>, <code>focus 2</code>, <code>type 3 text</code>, or <code>select 4 value</code>.</p>
    <p role="status" className="text-sm">{status}</p>
    {labels.length ? <ol className="max-h-44 list-decimal overflow-auto pl-8 text-sm">{labels.map((label, index) => <li key={index}>{label}</li>)}</ol> : null}
    <iframe ref={frame} src={page} title="Jumping Jax browser controls" onLoad={reset} className="h-[32rem] w-full rounded-lg bg-white" />
  </section>;
}
