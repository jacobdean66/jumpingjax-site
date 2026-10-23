import assert from "node:assert/strict";
import test from "node:test";
import { generateWritingSuggestions } from "./writing-suggestions-service";
import { quickWritingSuggestions, safeWritingDraft, writingSuggestionInput } from "./writing-suggestions";

test("typing help stays useful without AI and with unfinished words", () => {
  assert.match(quickWritingSuggestions("booking conf")[1], /confirmations/);
  assert.match(quickWritingSuggestions("broken button")[1], /Code repairs/);
  assert.equal(quickWritingSuggestions("").length, 3);
  assert.equal(writingSuggestionInput.safeParse({ draft: "a" }).success, false);
  assert.equal(writingSuggestionInput.safeParse({ draft: "x".repeat(501) }).success, false);
});

test("invitation correction suggestions stay on invitations even when the draft mentions fixing a booking", () => {
  for (const draft of ["fix the invitation", "booking invitation layout", "fix invita", "change an invite picture"]) {
    const suggestions = quickWritingSuggestions(draft);
    assert.equal(suggestions.length, 3);
    assert.ok(suggestions.every(value => /invitation/i.test(value)));
    assert.ok(suggestions.every(value => !/Code repairs|website/i.test(value)));
  }
});

test("credentials and customer contact details never become provider input", async () => {
  for (const draft of ["password=not-for-the-model", "ask example@example.com", "call 864-555-0123", "key sk-proj-abcdefghijklmnopqrstuvwxyz123456"]) {
    assert.equal(safeWritingDraft(draft), false);
    assert.deepEqual(quickWritingSuggestions(draft), []);
    await assert.rejects(generateWritingSuggestions(draft, undefined, async () => { throw new Error("Provider must not run"); }), /Private draft/);
  }
});

test("generation uses the actual unfinished draft, bounded output, no tools, and validates the response", async () => {
  const old = { ALLOW_DIRECT_OPENAI: process.env.ALLOW_DIRECT_OPENAI, OPENAI_API_KEY: process.env.OPENAI_API_KEY };
  process.env.ALLOW_DIRECT_OPENAI = "true";
  process.env.OPENAI_API_KEY = "unit-test-only";
  try {
    let sent: Record<string, unknown> = {};
    const fetchImpl: typeof fetch = async (_url, init) => {
      sent = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ suggestions: ["Check why booking confirmations are delayed."] }) } }] }), { headers: { "content-type": "application/json" } });
    };
    assert.deepEqual(await generateWritingSuggestions("booking confirmation late", undefined, fetchImpl), ["Check why booking confirmations are delayed."]);
    assert.match(JSON.stringify(sent.messages), /booking confirmation late/);
    assert.equal(sent.store, false);
    assert.equal(sent.max_completion_tokens, 280);
    assert.equal(sent.tools, undefined);
    await assert.rejects(generateWritingSuggestions("booking confirmation late", undefined, async () => new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "{}" } }] }), { headers: { "content-type": "application/json" } })), /Incomplete/);
  } finally {
    for (const [key, value] of Object.entries(old)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
