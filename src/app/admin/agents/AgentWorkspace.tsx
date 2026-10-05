"use client";

import { useEffect, useState, type ReactNode } from "react";

const tabs = [
  { id: "supervisor", label: "Permanent agent" },
  { id: "agent-controls", label: "Agents & activity" },
  { id: "agent-conversations", label: "Conversations" },
  { id: "agent-tools", label: "Tools & diagnostics" },
] as const;
type TabId = typeof tabs[number]["id"];

export function AgentWorkspace({ supervisor, controls, conversations, tools, initialConversation = false }: {
  supervisor: ReactNode; controls: ReactNode; conversations: ReactNode; tools: ReactNode; initialConversation?: boolean;
}) {
  const [active, setActive] = useState<TabId>(initialConversation ? "agent-conversations" : "supervisor");
  useEffect(() => {
    const sync = () => {
      const id = window.location.hash.slice(1);
      if (tabs.some((tab) => tab.id === id)) setActive(id as TabId);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
    };
  }, []);
  const panels = { supervisor, "agent-controls": controls, "agent-conversations": conversations, "agent-tools": tools };
  function select(id: TabId) {
    setActive(id);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${id}`);
  }
  return <div className="mt-5">
    <nav aria-label="Agent Manager sections" className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2" role="tablist">
      {tabs.map((tab, index) => <button key={tab.id} id={`${tab.id}-tab`} type="button" role="tab" aria-selected={active === tab.id} aria-controls={tab.id} tabIndex={active === tab.id ? 0 : -1}
        onClick={() => select(tab.id)} onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
          select(tabs[next].id);
          document.getElementById(`${tabs[next].id}-tab`)?.focus();
        }} className={`min-h-11 flex-1 rounded-xl px-4 py-2 text-sm font-black whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${active === tab.id ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}>{tab.label}</button>)}
    </nav>
    {tabs.map((tab) => <div key={tab.id} id={tab.id} role="tabpanel" aria-labelledby={`${tab.id}-tab`} hidden={active !== tab.id} tabIndex={0}>{panels[tab.id]}</div>)}
  </div>;
}
