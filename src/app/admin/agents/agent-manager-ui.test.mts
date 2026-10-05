import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SupervisorChat } from "./SupervisorChat";
import { AgentWorkspace } from "./AgentWorkspace";
import { agentConversationHref, agentWorkspaceHref, supervisorIssueAction } from "./navigation";
import { AgentNetworkPanel } from "./AgentNetworkPanel";
import { formatAgentTime } from "./time";
import { AGENT_DIRECTORY } from "@/lib/agent-manager/network/contracts";

test("saved permanent-agent chats render newest first without mutating history", () => {
  const messages = [
    { id: "old", question: "Old question", reply: "Old reply", createdAt: "2026-10-01T12:00:00Z" },
    { id: "new", question: "Latest question", reply: "Latest reply", createdAt: "2026-10-04T12:00:00Z", relatedAction: { label: "Open review", href: "/admin/agents?conversation=example#agent-conversations", kind: "agent_network" as const } },
    { id: "middle", question: "Middle question", reply: "Middle reply", createdAt: "2026-10-02T12:00:00Z" },
  ];
  const html = renderToStaticMarkup(createElement(SupervisorChat, { initialMessages: messages, initialSnapshot: null }));
  assert.ok(html.indexOf("Latest question") < html.indexOf("Middle question"));
  assert.ok(html.indexOf("Middle question") < html.indexOf("Old question"));
  assert.deepEqual(messages.map((message) => message.id), ["old", "new", "middle"]);
  assert.match(html, /Newest first/);
  assert.match(html, /href="\/admin\/agents\?conversation=example#agent-conversations"/);
});

test("manager opens permanent chat by default and saved conversations directly", () => {
  const panels = { supervisor: "Chat", controls: "Controls", conversations: "History", tools: "Tools" };
  const home = renderToStaticMarkup(createElement(AgentWorkspace, panels));
  const saved = renderToStaticMarkup(createElement(AgentWorkspace, { ...panels, initialConversation: true }));
  assert.match(home, /id="supervisor" role="tabpanel" aria-labelledby="supervisor-tab" tabindex="0"/);
  assert.match(home, /id="agent-conversations" role="tabpanel" aria-labelledby="agent-conversations-tab" hidden=""/);
  assert.match(saved, /id="supervisor" role="tabpanel" aria-labelledby="supervisor-tab" hidden=""/);
  assert.match(saved, /id="agent-conversations" role="tabpanel" aria-labelledby="agent-conversations-tab" tabindex="0"/);
});

test("specialist workspace actions lead to existing owner workflows", () => {
  assert.equal(agentWorkspaceHref("booking"), "/admin/rentals");
  assert.equal(agentWorkspaceHref("availability"), "/admin/schedule");
  assert.equal(agentWorkspaceHref("receptionist"), "/admin/answering-machine");
  assert.equal(agentWorkspaceHref("image-director"), "/admin/social-posts");
  assert.equal(agentWorkspaceHref("unknown"), undefined);
});

test("agent card links open a request with the selected specialist and capability", () => {
  assert.equal(agentConversationHref("waiver"), "/admin/agents?agent=waiver#agent-conversations");
  assert.equal(agentConversationHref("supervisor"), "/admin/agents#supervisor");
  const initial = { directory: AGENT_DIRECTORY.map((agent) => ({ ...agent, available: true, status: "adapter ready" })), contexts: [], activeTasks: 0, emergencyStop: false };
  const html = renderToStaticMarkup(createElement(AgentNetworkPanel, { initial, initialRecipient: "waiver" }));
  assert.match(html, /Ask Waiver Agent/);
  assert.match(html, /value="waiver" selected=""/);
  assert.match(html, /value="waiver_review" selected=""/);
  assert.doesNotMatch(html, /Rental item references/);
});

test("service issues open the matching service rather than generic website settings", () => {
  const services = [
    { key: "ads", name: "Ad Analytics", href: "/admin/ad-analytics" },
    { key: "calls", name: "Answering Machine", href: "/admin/answering-machine" },
  ];
  assert.deepEqual(supervisorIssueAction({ code: "service:ads:setup-required", area: "website" }, services), { href: "/admin/ad-analytics", label: "Open Ad Analytics" });
  assert.equal(supervisorIssueAction({ code: "service:calls:setup-required", area: "website" }, services).href, "/admin/answering-machine");
  assert.equal(supervisorIssueAction({ code: "agents:nomination:setup-required", area: "agents" }, services).href, "/admin/giveaway");
  assert.equal(supervisorIssueAction({ code: "agents:stale-jobs", area: "agents" }, services).href, "#agent-controls");
});


test("agent timestamps show the business timezone on both server and client", () => {
  assert.equal(formatAgentTime("2026-10-04T12:00:00Z"), "10/4/2026, 8:00:00 AM");
  assert.equal(formatAgentTime("2026-01-04T12:00:00Z"), "1/4/2026, 7:00:00 AM");
});
