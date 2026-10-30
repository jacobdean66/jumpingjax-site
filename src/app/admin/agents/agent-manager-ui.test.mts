import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SupervisorChat } from "./SupervisorChat";
import { SupervisorReply } from "./SupervisorReply";
import { CodeRepairHistory } from "./CodeRepairHistory";
import { CodeRepairClient } from './CodeRepairClient';
import type { AdminInventoryItem } from '@/lib/admin/inventory';
import type { CodeRepairItem } from "@/lib/agent-manager/code-repair";
import { AgentWorkspace } from "./AgentWorkspace";
import { agentConversationHref, agentWorkspaceHref, supervisorIssueAction } from "./navigation";
import { AgentNetworkPanel } from "./AgentNetworkPanel";
import { formatAgentTime } from "./time";
import { AGENT_DIRECTORY } from "@/lib/agent-manager/network/contracts";

test('review drafts populate the real forms without submitting or publishing', async context => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'unit-test-only';
  context.after(() => {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  });
  const { InventoryItemForm } = await import('../inventory/InventoryItemForm');
  const draft = { title: 'Rainbow slide', categoryId: 'water-slides' as const, startingPrice: null, shortDescription: 'Colorful slide', description: 'Owner supplied product details.' };
  const html = renderToStaticMarkup(createElement(InventoryItemForm, { token: '', cancelHref: '/admin/inventory', draft }));
  assert.match(html, /name="title"[^>]*value="Rainbow slide"/);
  assert.match(html, /option value="water-slides" selected=""/);
  assert.match(html, /<input\b(?=[^>]*name="startingPrice")(?=[^>]*required="")(?=[^>]*value="")[^>]*>/);
  assert.match(html, /This draft has not added an item/);
  assert.doesNotMatch(html, /<input\b(?=[^>]*name="publicVisible")(?=[^>]*checked)[^>]*>|name="id"/);
  const existing = { id: 'existing', title: 'Existing slide', categoryId: 'slides', media: [], startingPrice: 200, description: '', shortDescription: '', setupRequirements: [] } as unknown as AdminInventoryItem;
  const edit = renderToStaticMarkup(createElement(InventoryItemForm, { token: '', cancelHref: '/admin/inventory', draft, item: existing }));
  assert.match(edit, /name="title"[^>]*value="Existing slide"/);
  assert.doesNotMatch(edit, /Rainbow slide|This draft has not added an item/);
  const code = renderToStaticMarkup(createElement(CodeRepairClient, { draft: { description: 'Fix clipped office print content', pagePath: '/admin/invoices/inbox/print', expectedText: 'Office email' } }));
  assert.match(code, /Fix clipped office print content/);
  assert.match(code, /value="\/admin\/invoices\/inbox\/print"/);
  assert.match(code, /owner preview checks/);
});

test('chat shows bounded checked-source evidence without exposing result bodies or rendering HTML', () => {
  const html = renderToStaticMarkup(createElement(SupervisorChat, { initialSnapshot: null, initialMessages: [{ id: 'lookup', question: 'Check the homepage', reply: 'I checked its source.', createdAt: '2026-10-30T12:00:00Z', evidence: [{ tool: 'repository_read', source: 'src/app/page.tsx:1 <script>bad</script>', checkedAt: '2026-10-30T12:00:00Z', ok: true, limited: false }] }] }));
  assert.match(html, /Sources checked \(1\)/);
  assert.match(html, /<details/);
  assert.doesNotMatch(html, /<script>|<details[^>]*open/);
  assert.match(html, /src\/app\/page.tsx:1/);
});

test("repair history leads with a readable status and keeps technical requests collapsed", () => {
  const repair = { id: "example", status: "review_ready", page_path: "/service-area", created_at: "2026-10-23T01:15:53Z", description: "Acceptance test: wrap the breadcrumb in aria-current=page. <script>unsafe</script>", result: { summary: "Your tested fix is ready to review.", pullRequestUrl: "https://github.com/jacobdean66/jumpingjax-site/pull/194" }, run_url: "https://github.com/jacobdean66/jumpingjax-site/actions/runs/1" } as CodeRepairItem;
  const html = renderToStaticMarkup(createElement(CodeRepairHistory, { repairs: [repair], onCancel: () => {} }));
  assert.match(html, /<h3[^>]*>Website repair<\/h3>/);
  assert.match(html, /Ready for your review/);
  assert.match(html, /<details[^>]*><summary[^>]*>Request details<\/summary>/);
  assert.doesNotMatch(html, /<details[^>]*open|<script>|<h3[^>]*>Acceptance test/);
  assert.match(html, /aria-current=page/);
  assert.match(html, /href="https:\/\/github.com\/jacobdean66\/jumpingjax-site\/pull\/194"/);
  assert.doesNotMatch(html, /Cancel repair/);
  const pending = renderToStaticMarkup(createElement(CodeRepairHistory, { repairs: [{ ...repair, status: "queued", result: null }], onCancel: () => {} }));
  assert.match(pending, /Waiting to start/);
  assert.match(pending, /Cancel repair/);
});

test("replies preserve paragraphs, safely render lists and collapse old long reports", () => {
  const html = renderToStaticMarkup(createElement(SupervisorReply, { text: "Yes, we can improve it.\n\n- Clearer wording\n- Easier editing\n\nWhich part first?" }));
  assert.match(html, /<ul/);
  assert.match(html, /<li>Clearer wording<\/li>/);
  assert.match(html, /<p[^>]*>Which part first\?<\/p>/);
  const long = renderToStaticMarkup(createElement(SupervisorReply, { text: Array.from({ length: 25 }, (_, i) => `Status ${i}: the service is reporting a detailed health finding that should remain available.`).join(" ") }));
  assert.match(long, /<details>/);
  assert.match(long, /Show full reply/);
  const unsafe = renderToStaticMarkup(createElement(SupervisorReply, { text: "<script>alert(1)</script>" }));
  assert.doesNotMatch(unsafe, /<script>/);
});

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
  const panels = { supervisor: "Chat", controls: "Controls", conversations: "History", tools: "Tools", techSearch: "Research" };
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
