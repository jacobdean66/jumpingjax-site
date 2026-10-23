import assert from "node:assert/strict";
import test from "node:test";
import { generateSupervisorReply } from "./conversation-reply-provider";
import { codingConversationAction, readableReplyParagraphs, supervisorReplyContext } from "./conversation-reply";
import type { SupervisorSnapshot } from "./supervisor";

const snapshot = { generatedAt: "2026-10-23T02:00:00Z", website: [], bookings: {}, agents: {}, wiring: [{ key: "coding", state: "connected" }], issues: [{ area: "security", summary: "Unrelated security warning" }] } as unknown as SupervisorSnapshot;

test("coding questions offer the repair form without submitting a job", () => {
  const action = { kind: "code_repair", label: "Open website code repairs", href: "/admin/agents#code-repairs" };
  assert.deepEqual(codingConversationAction("Can you edit coding?"), action);
  assert.deepEqual(codingConversationAction("Can you fix coding issues"), action);
  assert.deepEqual(codingConversationAction("Can it fix coding repairs?"), action);
  assert.deepEqual(codingConversationAction("Fix the broken website button"), action);
  assert.deepEqual(codingConversationAction("Could you write code for the website?"), action);
  assert.equal(codingConversationAction("Can we revamp invitations?"), null);
  assert.equal(codingConversationAction("Where is my passcode?"), null);
});

test("coding context distinguishes tested draft edits, connection freshness and unsupported admin changes", () => {
  const connected = supervisorReplyContext("Can you edit coding?", snapshot).coding as Record<string, unknown>;
  assert.match(String(connected.connection), /checked in recently/);
  assert.match(String(connected.review), /actual code edits.*draft pull request/);
  assert.match(String(connected.workflow), /does not queue a repair/);
  assert.match(String(connected.scope), /invitation builder.*outside this worker's scope/);
  const unavailable = supervisorReplyContext("Can you edit coding?", { ...snapshot, wiring: [], agents: { ...snapshot.agents, emergencyStop: true } }).coding as Record<string, unknown>;
  assert.match(String(unavailable.connection), /No recent worker connection/);
  assert.equal(unavailable.executionPaused, true);
});

test("an invitation design question is not padded with unrelated health findings", () => {
  const context = supervisorReplyContext("Can we revamp the invitations at all?", snapshot);
  assert.match(JSON.stringify(context), /invitation/);
  assert.equal(context.issues, undefined);
  assert.equal(context.agents, undefined);
  assert.equal(context.bookings, undefined);
  assert.deepEqual(supervisorReplyContext("Check the website status", snapshot).issues, [{ area: "security", summary: "Unrelated security warning" }]);
});

test("old status dumps become readable paragraphs without losing details", () => {
  const text = Array.from({ length: 10 }, (_, i) => `Status item ${i} has a long description of what the service observed.`).join(" ");
  const parts = readableReplyParagraphs(text);
  assert.ok(parts.length >= 3);
  assert.equal(parts.join(" "), text);
  const withVersions = `Next.js 16.3.6 is installed. ${text} Details at https://example.com/version.`;
  assert.equal(readableReplyParagraphs(withVersions).join(" "), withVersions);
  assert.deepEqual(readableReplyParagraphs("Yes, we can.\n\nWhich part would you change?"), ["Yes, we can.", "Which part would you change?"]);
});

test("follow-ups include recent actor history in order and generate text without action tools", async () => {
  const old = { ALLOW_DIRECT_OPENAI: process.env.ALLOW_DIRECT_OPENAI, OPENAI_API_KEY: process.env.OPENAI_API_KEY };
  process.env.ALLOW_DIRECT_OPENAI = "true";
  process.env.OPENAI_API_KEY = "unit-test-only";
  try {
    let sent: Record<string, unknown> = {};
    const reply = "Yes—we can simplify the invitation editor.\n\nWhich part is hardest to change?";
    const result = await generateSupervisorReply({ message: "Make it easier to edit", context: {}, history: [{ question: "Can we revamp the invitations?", reply: "Yes. What would you change?" }] }, undefined, async (_url, init) => {
      sent = JSON.parse(String(init?.body));
      return Response.json({ choices: [{ finish_reason: "stop", message: { content: reply } }] });
    });
    assert.equal(result, reply);
    const messages = sent.messages as Array<{ role: string; content: string }>;
    assert.equal(messages.at(-1)?.content, "Make it easier to edit");
    assert.equal(messages.at(-3)?.content, "Can we revamp the invitations?");
    assert.equal(sent.tools, undefined);
    assert.equal(sent.store, false);
    await assert.rejects(generateSupervisorReply({ message: "Can we revamp invitations?", context: {}, history: [] }, undefined, async () => Response.json({ choices: [{ finish_reason: "length", message: { content: "unfinished" } }] })), /unavailable/);
  } finally { for (const [key, value] of Object.entries(old)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});
